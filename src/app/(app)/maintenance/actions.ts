"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import {
  canExecuteMaintenanceWorkOrder,
  disposalReasonForMaintenanceOutcome,
  computeAssetStatusAfterMaintenanceOutcome,
  computeNextPlanDue,
} from "@/lib/ga-operations";
import { createWorkOrderInternal } from "@/lib/maintenance-create";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import { createDisposalCaseInternal } from "@/lib/disposal-create";
import type { MaintenanceWorkType, MaintenanceOutcome } from "@/generated/prisma/enums";

export async function createMaintenancePlan(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const assetId = (formData.get("assetId") as string)?.trim();
  if (!assetId) return "Aset wajib dipilih.";
  const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
  if (!asset) return "Aset tidak ditemukan.";

  const description = (formData.get("description") as string)?.trim();
  if (!description) return "Deskripsi rencana wajib diisi.";

  const dueDateRaw = (formData.get("dueDate") as string)?.trim();
  const intervalDaysRaw = (formData.get("intervalDays") as string)?.trim();
  const intervalKmRaw = (formData.get("intervalKm") as string)?.trim();
  const dueKmRaw = (formData.get("dueKm") as string)?.trim();
  for (const [label, raw] of [["Interval hari", intervalDaysRaw], ["Interval km", intervalKmRaw], ["Jatuh tempo km", dueKmRaw]] as const) {
    if (raw && !(Number.isInteger(Number(raw)) && Number(raw) > 0)) return `${label} harus berupa angka bulat lebih dari 0.`;
  }
  if ((formData.get("autoCreateWorkOrder") === "on") && !dueDateRaw) return "Work order otomatis butuh tanggal jatuh tempo.";

  const plan = await prisma.maintenancePlan.create({
    data: {
      assetId,
      description,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      intervalDays: intervalDaysRaw ? Number(intervalDaysRaw) : null,
      intervalKm: intervalKmRaw ? Number(intervalKmRaw) : null,
      dueKm: dueKmRaw ? Number(dueKmRaw) : null,
      autoCreateWorkOrder: formData.get("autoCreateWorkOrder") === "on",
      createdByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "MaintenancePlan",
    recordId: plan.id,
    reason: `Preventive plan created for "${asset.assetName}" (${asset.assetCode})`,
  });

  revalidatePath("/maintenance/plans");
  revalidatePath(`/assets/${assetId}`);
  return undefined;
}

// Immutable history — a plan is retired, never deleted, matching every
// other soft-close in this app.
export async function deactivateMaintenancePlan(planId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  if (!plan) return "Rencana tidak ditemukan.";
  if (!plan.activeFlag) return "Rencana ini sudah tidak aktif.";

  await prisma.maintenancePlan.update({ where: { id: planId }, data: { activeFlag: false } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MaintenancePlan",
    recordId: planId,
    reason: "Preventive plan deactivated",
  });

  revalidatePath("/maintenance/plans");
  return undefined;
}

async function createWorkOrder(params: {
  assetId: string;
  sourceType: "PREVENTIVE" | "CORRECTIVE";
  sourcePlanId?: string | null;
  sourceGaRequestId?: string | null;
  session: Awaited<ReturnType<typeof requireSession>>;
  formData: FormData;
}): Promise<{ id: string } | string> {
  const workTypeRaw = params.formData.get("workType") as string;
  if (!["INTERNAL", "VENDOR"].includes(workTypeRaw)) return "Internal atau vendor wajib dipilih.";
  const workType = workTypeRaw as MaintenanceWorkType;
  const checklistNotes = (params.formData.get("checklistNotes") as string)?.trim() || null;

  const workOrder = await createWorkOrderInternal({
    assetId: params.assetId,
    sourceType: params.sourceType,
    sourcePlanId: params.sourcePlanId,
    sourceGaRequestId: params.sourceGaRequestId,
    workType,
    checklistNotes,
    createdByAccountId: params.session.user.id,
  });

  return { id: workOrder.id };
}

export async function createWorkOrderFromPlan(planId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  if (!plan) return "Rencana tidak ditemukan.";
  if (!plan.activeFlag) return "Rencana ini sudah tidak aktif.";

  const result = await createWorkOrder({ assetId: plan.assetId, sourceType: "PREVENTIVE", sourcePlanId: planId, session, formData });
  if (typeof result === "string") return result;

  revalidatePath("/maintenance/work-orders");
  revalidatePath(`/maintenance/work-orders/${result.id}`);
  revalidatePath(`/assets/${plan.assetId}`);
  return undefined;
}

// PDF: "Execute maintenance" -> "Record date/KM, action, cost and
// evidence" -> "Outcome?" -> Operational (update condition and next due) or
// Beyond repair (disposal). A BEYOND_REPAIR outcome always auto-drafts a
// DisposalCase; an OPERATIONAL outcome returns the asset to whatever
// circulation state its current custody implies (IN_USE if still held,
// AVAILABLE otherwise) and rolls the source plan's dueDate forward if one
// was recorded.
export async function executeMaintenanceWorkOrder(
  workOrderId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const workOrder = await prisma.maintenanceWorkOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) return "Work order tidak ditemukan.";
  if (!canExecuteMaintenanceWorkOrder(workOrder.status)) return "Work order ini sudah selesai diproses.";

  const serviceDateRaw = (formData.get("serviceDate") as string)?.trim();
  if (!serviceDateRaw) return "Tanggal servis wajib diisi.";
  const odometerKmRaw = (formData.get("odometerKm") as string)?.trim();
  const diagnosisNote = (formData.get("diagnosisNote") as string)?.trim() || null;
  const actionTakenNote = (formData.get("actionTakenNote") as string)?.trim();
  if (!actionTakenNote) return "Tindakan yang dilakukan wajib diisi.";
  const costRaw = (formData.get("cost") as string)?.trim();
  const outcomeRaw = formData.get("outcome") as string;
  if (!["OPERATIONAL", "BEYOND_REPAIR"].includes(outcomeRaw)) return "Hasil perawatan wajib dipilih.";
  const outcome = outcomeRaw as MaintenanceOutcome;
  const nextDueDateRaw = (formData.get("nextDueDate") as string)?.trim();
  const nextDueKmRaw = (formData.get("nextDueKm") as string)?.trim();

  let evidenceFileId: string | undefined;
  const evidenceFile = formData.get("evidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("maintenance-evidence", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        uploadedByAccountId: session.user.id,
        category: "MAINTENANCE_EVIDENCE",
        confidential: false,
      },
    });
    evidenceFileId = fileObject.id;
  }

  const openCustody = await prisma.assetCustody.findFirst({ where: { assetId: workOrder.assetId, status: { not: "RETURNED" } } });
  const newAssetStatus = computeAssetStatusAfterMaintenanceOutcome(outcome, !!openCustody);
  const nextDueDate = nextDueDateRaw ? new Date(nextDueDateRaw) : null;
  const nextDueKm = nextDueKmRaw ? Number(nextDueKmRaw) : null;

  // The plan comes due again one interval after this service, unless the dates were typed.
  const plan = workOrder.sourcePlanId ? await prisma.maintenancePlan.findUnique({ where: { id: workOrder.sourcePlanId } }) : null;
  const serviceDate = new Date(serviceDateRaw);
  const odometerKm = odometerKmRaw ? Number(odometerKmRaw) : null;
  const nextDue = plan
    ? computeNextPlanDue({
        serviceDate,
        odometerKm,
        intervalDays: plan.intervalDays,
        intervalKm: plan.intervalKm,
        enteredNextDueDate: nextDueDate,
        enteredNextDueKm: nextDueKm,
      })
    : { dueDate: nextDueDate, dueKm: nextDueKm };

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceWorkOrder.update({
      where: { id: workOrderId },
      data: {
        status: "COMPLETED",
        serviceDate: new Date(serviceDateRaw),
        odometerKm: odometerKmRaw ? Number(odometerKmRaw) : null,
        diagnosisNote,
        actionTakenNote,
        cost: costRaw ? Number(costRaw) : null,
        evidenceFileId,
        outcome,
        nextDueDate: nextDue.dueDate,
        nextDueKm: nextDue.dueKm,
        completedByAccountId: session.user.id,
        completedAt: new Date(),
      },
    });
    await tx.fixedAsset.update({ where: { id: workOrder.assetId }, data: { status: newAssetStatus } });
    // Only an operational result rolls the plan forward; a beyond-repair asset is heading for disposal.
    if (workOrder.sourcePlanId && outcome === "OPERATIONAL" && (nextDue.dueDate || nextDue.dueKm !== null)) {
      await tx.maintenancePlan.update({
        where: { id: workOrder.sourcePlanId },
        data: { dueDate: nextDue.dueDate ?? undefined, dueKm: nextDue.dueKm ?? undefined },
      });
    }
    // The damage report behind a corrective work order closes with it.
    if (workOrder.sourceGaRequestId) {
      await tx.gaRequest.updateMany({
        where: { id: workOrder.sourceGaRequestId, status: "WORK_ORDER_CREATED" },
        data: { status: "COMPLETED" },
      });
    }
  });

  const disposalReason = disposalReasonForMaintenanceOutcome(outcome);
  if (disposalReason) {
    await createDisposalCaseInternal({
      assetId: workOrder.assetId,
      reason: disposalReason,
      createdByAccountId: session.user.id,
      sourceWorkOrderId: workOrderId,
      proposalNote: diagnosisNote,
    });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MaintenanceWorkOrder",
    recordId: workOrderId,
    reason: `${workOrder.workOrderNumber} executed — outcome ${outcome}`,
  });

  revalidatePath(`/maintenance/work-orders/${workOrderId}`);
  revalidatePath("/maintenance/work-orders");
  revalidatePath(`/assets/${workOrder.assetId}`);
  if (workOrder.sourceGaRequestId) revalidatePath(`/ga-requests/${workOrder.sourceGaRequestId}`);
  if (disposalReason) revalidatePath("/disposal-cases");
  return undefined;
}

// The start point for work that nobody reported: GA Admin saw a problem, or wants a one-off
// service, and opens a work order straight from the Work Order Perawatan page.
//   Perbaikan (corrective): the asset leaves circulation at once, like an accepted damage report.
//   Perawatan rutin (preventive): the asset's status does not change.
export async function createManualWorkOrder(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const assetId = (formData.get("assetId") as string)?.trim();
  if (!assetId) return "Aset wajib dipilih.";
  const kind = formData.get("kind") as string;
  if (!["CORRECTIVE", "PREVENTIVE"].includes(kind)) return "Jenis work order wajib dipilih.";
  const workTypeRaw = formData.get("workType") as string;
  if (!["INTERNAL", "VENDOR"].includes(workTypeRaw)) return "Internal atau vendor wajib dipilih.";
  const checklistNotes = (formData.get("checklistNotes") as string)?.trim();
  if (!checklistNotes) return "Keluhan atau pekerjaan yang akan dilakukan wajib diisi.";

  const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.activeFlag) return "Aset tidak ditemukan atau tidak aktif.";
  if (["RETIRED", "DISPOSED", "PENDING_DISPOSAL"].includes(asset.status)) return "Aset ini sudah atau sedang dalam proses disposal.";

  const open = await prisma.maintenanceWorkOrder.findFirst({ where: { assetId, status: "OPEN" }, select: { workOrderNumber: true } });
  if (open) return `Aset ini sudah punya work order terbuka (${open.workOrderNumber}).`;

  const workOrder = await createWorkOrderInternal({
    assetId,
    sourceType: kind as "CORRECTIVE" | "PREVENTIVE",
    workType: workTypeRaw as MaintenanceWorkType,
    checklistNotes,
    createdByAccountId: session.user.id,
    auditNote: `${kind.toLowerCase()}, opened manually`,
  });
  if (kind === "CORRECTIVE") {
    await prisma.fixedAsset.update({ where: { id: assetId }, data: { status: "UNDER_REPAIR" } });
  }

  revalidatePath("/maintenance/work-orders");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath(`/maintenance/work-orders/${workOrder.id}`);
  return undefined;
}

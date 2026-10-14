"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations, canSubmitGaRequest, canCancelGaRequest } from "@/lib/permissions";
import {
  formatGaRequestNumber,
  canVerifyGaRequest,
  routeGaRequestAfterVerification,
  canDecideGaRequest,
  decideGaRequestStatus,
  canProcessGaRequest,
  canReviewGaRequestLoss,
  canDecideDamageRequest,
  assetStatusAfterLossDecision,
  decideGaRequestLossStatus,
  canCancelGaRequestStatus,
  computeAssetStatusAfterLossReview,
} from "@/lib/ga-operations";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import { assignAssetToEmployee, assignAssetToDepartment } from "@/app/(app)/assets/actions";
import { createDisposalCaseInternal } from "@/lib/disposal-create";
import { createWorkOrderInternal } from "@/lib/maintenance-create";
import type { GaRequestType, GaRequestUrgency } from "@/generated/prisma/enums";

export async function submitGaRequest(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canSubmitGaRequest(session)) return t("common.forbidden");

  const requestTypeRaw = formData.get("requestType") as string;
  if (!["NEW_ASSET_NEED", "DAMAGE_OR_ABNORMAL_CONDITION", "LOSS"].includes(requestTypeRaw)) {
    return "Jenis permintaan wajib dipilih.";
  }
  const requestType = requestTypeRaw as GaRequestType;

  const urgencyRaw = (formData.get("urgency") as string) || "MEDIUM";
  if (!["LOW", "MEDIUM", "HIGH"].includes(urgencyRaw)) return "Urgensi tidak valid.";
  const urgency = urgencyRaw as GaRequestUrgency;

  const description = (formData.get("description") as string)?.trim();
  if (!description) return "Deskripsi wajib diisi.";

  const assetId = (formData.get("assetId") as string)?.trim() || null;
  if ((requestType === "DAMAGE_OR_ABNORMAL_CONDITION" || requestType === "LOSS") && !assetId) {
    return "Aset wajib dipilih untuk laporan kerusakan atau kehilangan.";
  }
  if (assetId) {
    const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset) return "Aset tidak ditemukan.";
  }

  const locationId = (formData.get("locationId") as string)?.trim() || null;

  let evidenceFileId: string | undefined;
  const evidenceFile = formData.get("evidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("ga-request", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        employeeId: session.user.employeeId,
        uploadedByAccountId: session.user.id,
        category: "GA_REQUEST_EVIDENCE",
        confidential: false,
      },
    });
    evidenceFileId = fileObject.id;
  }

  const year = companyYear();
  const seq = await nextSequence(`GAR-${year}`);
  const requestNumber = formatGaRequestNumber(seq, year);

  const created = await prisma.gaRequest.create({
    data: {
      requestNumber,
      requestType,
      urgency,
      description,
      requesterEmployeeId: session.user.employeeId!,
      submittedByAccountId: session.user.id,
      assetId,
      locationId,
      evidenceFileId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "GaRequest",
    recordId: created.id,
    reason: `Submitted ${requestType} request ${requestNumber}`,
  });

  revalidatePath("/ga-requests");
  redirect(`/ga-requests/${created.id}`);
}

// PDF: "GA Admin verifies asset, location and urgency" then routes by
// requestType. Immediately moves a damaged/lost asset out of normal
// circulation (see computeAssetStatusAfterGaRequestVerification) so it
// can't be assigned while the issue is unresolved.
export async function verifyGaRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canVerifyGaRequest(request.status)) return "Permintaan ini sudah diverifikasi atau tidak lagi menunggu verifikasi.";
  if (request.requestType !== "NEW_ASSET_NEED") {
    return "Gunakan tombol Terima atau Tolak untuk laporan kerusakan, dan Konfirmasi hilang untuk laporan kehilangan.";
  }

  const verificationNote = (formData.get("verificationNote") as string)?.trim() || null;

  // GA Admin decides every New Asset Need request directly now — no
  // configurable approver Position to possibly leave unset, so approval is
  // always required (was previously conditional on whether a Position was
  // configured).
  const approvalRequired: boolean | null = request.requestType === "NEW_ASSET_NEED" ? true : null;

  const newStatus = routeGaRequestAfterVerification(request.requestType, approvalRequired ?? false);

  // GA Admin may fill the evidence gap here if the requester didn't attach
  // one at submission ("Record loss incident and evidence" is a GA Admin
  // step per the PDF, not necessarily the requester's).
  let evidenceFileId: string | undefined;
  if (!request.evidenceFileId) {
    const evidenceFile = formData.get("evidenceFile") as File | null;
    if (evidenceFile && evidenceFile.size > 0) {
      const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
      if (validationError) return validationError;
      const storageKey = randomStorageKey("ga-request", getExtension(evidenceFile.name));
      const bytes = Buffer.from(await evidenceFile.arrayBuffer());
      await savePrivateFile(storageKey, bytes);
      const fileObject = await prisma.fileObject.create({
        data: {
          storageKey,
          originalFileName: evidenceFile.name,
          mimeType: evidenceFile.type,
          sizeBytes: evidenceFile.size,
          sensitivity: "RESTRICTED",
          employeeId: request.requesterEmployeeId,
          uploadedByAccountId: session.user.id,
          category: "GA_REQUEST_EVIDENCE",
          confidential: false,
        },
      });
      evidenceFileId = fileObject.id;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.gaRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        verifiedAt: new Date(),
        verifiedByAccountId: session.user.id,
        verificationNote,
        approvalRequired,
        evidenceFileId: evidenceFileId ?? request.evidenceFileId,
      },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} verified, routed to ${newStatus}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  if (request.assetId) revalidatePath(`/assets/${request.assetId}`);
  return undefined;
}

// GA Admin decides New Asset Need requests directly — no separate
// configurable approver Position.
export async function decideGaRequestAsApprover(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canDecideGaRequest(request.status)) return "Permintaan ini belum siap untuk diputuskan atau sudah diproses.";

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if (decision === "REJECT" && !decisionNote) return "Alasan penolakan wajib diisi.";

  await prisma.gaRequest.update({
    where: { id: requestId },
    data: {
      status: decideGaRequestStatus(decision === "APPROVE"),
      decisionAt: new Date(),
      decisionByAccountId: session.user.id,
      decisionNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVE" ? "APPROVE" : "REJECT",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: decisionNote ?? `${request.requestNumber} ${decision === "APPROVE" ? "approved" : "rejected"}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  return undefined;
}

// PDF: "Allocate available asset or record procurement reference" — the
// hand-off to Phase 4A custody. Reuses the existing, unmodified assign*
// actions in assets/actions.ts rather than duplicating custody-creation
// logic; the created custody's id is looked up afterward (most recent for
// this asset) since those actions don't return it directly.
export async function processGaRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canProcessGaRequest(request.status)) return "Permintaan ini belum disetujui atau sudah diproses.";

  const processingMode = formData.get("processingMode") as string;

  if (processingMode === "PROCUREMENT") {
    const procurementReference = (formData.get("procurementReference") as string)?.trim();
    if (!procurementReference) return "Referensi pengadaan wajib diisi.";

    await prisma.gaRequest.update({
      where: { id: requestId },
      data: { status: "PROCESSED", processedAt: new Date(), processedByAccountId: session.user.id, procurementReference },
    });

    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "GaRequest",
      recordId: requestId,
      reason: `${request.requestNumber} processed via procurement reference ${procurementReference}`,
    });

    revalidatePath(`/ga-requests/${requestId}`);
    revalidatePath("/ga-requests");
    return undefined;
  }

  if (processingMode !== "ALLOCATE") return "Mode pemrosesan tidak valid.";

  const assetId = (formData.get("allocateAssetId") as string)?.trim();
  if (!assetId) return "Aset yang akan dialokasikan wajib dipilih.";
  const targetType = formData.get("targetType") as string;

  const innerFormData = new FormData();
  const conditionAtHandover = formData.get("conditionAtHandover") as string | null;
  if (conditionAtHandover) innerFormData.set("conditionAtHandover", conditionAtHandover);
  const quantity = formData.get("quantity") as string | null;
  if (quantity) innerFormData.set("quantity", quantity);
  const evidenceFile = formData.get("handoverEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) innerFormData.set("handoverEvidenceFile", evidenceFile);

  let assignError: string | undefined;
  if (targetType === "EMPLOYEE") {
    const employeeId = (formData.get("employeeId") as string)?.trim();
    if (!employeeId) return "Karyawan wajib dipilih.";
    innerFormData.set("employeeId", employeeId);
    assignError = await assignAssetToEmployee(assetId, undefined, innerFormData);
  } else if (targetType === "DEPARTMENT") {
    const orgUnitId = (formData.get("orgUnitId") as string)?.trim();
    if (!orgUnitId) return "Departemen wajib dipilih.";
    const locationId = (formData.get("locationId") as string)?.trim();
    if (!locationId) return "Lokasi wajib dipilih untuk penempatan ke departemen.";
    innerFormData.set("orgUnitId", orgUnitId);
    innerFormData.set("locationId", locationId);
    assignError = await assignAssetToDepartment(assetId, undefined, innerFormData);
  } else {
    return "Tujuan alokasi tidak valid.";
  }
  if (assignError) return assignError;

  const custody = await prisma.assetCustody.findFirst({ where: { assetId }, orderBy: { createdAt: "desc" } });

  await prisma.gaRequest.update({
    where: { id: requestId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      processedByAccountId: session.user.id,
      resultingCustodyId: custody?.id ?? null,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} processed — asset allocated via custody ${custody?.id ?? "?"}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  revalidatePath(`/assets/${assetId}`);
  return undefined;
}

// GA Admin reviews the loss directly (no separate configurable Position) ->
// "Confirmed: disposal" or a negative outcome that returns the asset to
// circulation. A confirmed loss auto-drafts a DisposalCase (reason
// CONFIRMED_LOSS) via the shared creator in disposal-cases/actions.ts, and
// also closes out the employee's open custody record for this asset — a
// confirmed loss means the item is gone, so leaving custody ACTIVE would
// keep blocking that employee's offboarding indefinitely with nothing left
// to resolve it.
// Damage report, one click: GA Admin accepts it and the corrective work order opens with it.
// The asset leaves circulation at once (it cannot be placed while it is being fixed); if
// someone still holds it, that placement stays open. The report closes itself when the
// work order is recorded (see executeMaintenanceWorkOrder).
export async function acceptDamageRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId }, include: { asset: true } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.requestType !== "DAMAGE_OR_ABNORMAL_CONDITION") return "Tindakan ini hanya untuk laporan kerusakan.";
  if (!canDecideDamageRequest(request.status)) return "Laporan ini sudah diterima atau tidak lagi menunggu.";
  if (!request.assetId || !request.asset) return "Laporan ini tidak memiliki aset terkait.";
  if (["RETIRED", "DISPOSED", "PENDING_DISPOSAL"].includes(request.asset.status)) {
    return "Aset ini sudah atau sedang dalam proses disposal.";
  }

  const workTypeRaw = formData.get("workType") as string;
  if (!["INTERNAL", "VENDOR"].includes(workTypeRaw)) return "Internal atau vendor wajib dipilih.";
  const checklistNotes = (formData.get("checklistNotes") as string)?.trim() || null;
  const verificationNote = (formData.get("verificationNote") as string)?.trim() || null;

  const existing = await prisma.maintenanceWorkOrder.findFirst({ where: { sourceGaRequestId: requestId } });
  if (existing) return `Work order untuk laporan ini sudah dibuat (${existing.workOrderNumber}).`;

  const workOrder = await createWorkOrderInternal({
    assetId: request.assetId,
    sourceType: "CORRECTIVE",
    sourceGaRequestId: requestId,
    workType: workTypeRaw as "INTERNAL" | "VENDOR",
    checklistNotes,
    createdByAccountId: session.user.id,
  });

  await prisma.$transaction([
    prisma.gaRequest.update({
      where: { id: requestId },
      data: {
        status: "WORK_ORDER_CREATED",
        verifiedAt: new Date(),
        verifiedByAccountId: session.user.id,
        verificationNote,
      },
    }),
    prisma.fixedAsset.update({ where: { id: request.assetId }, data: { status: "UNDER_REPAIR" } }),
  ]);

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} accepted, work order ${workOrder.workOrderNumber} opened`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  revalidatePath("/maintenance/work-orders");
  revalidatePath(`/assets/${request.assetId}`);
  return undefined;
}

// Turning a damage report down needs a reason and leaves the asset as it is.
export async function rejectDamageRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.requestType !== "DAMAGE_OR_ABNORMAL_CONDITION") return "Tindakan ini hanya untuk laporan kerusakan.";
  if (!canDecideDamageRequest(request.status)) return "Laporan ini sudah diterima atau tidak lagi menunggu.";

  const decisionNote = (formData.get("decisionNote") as string)?.trim();
  if (!decisionNote) return "Alasan penolakan wajib diisi.";

  await prisma.gaRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", decisionAt: new Date(), decisionByAccountId: session.user.id, decisionNote },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "REJECT",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} damage report turned down: ${decisionNote}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  return undefined;
}

export async function reviewGaRequestLoss(
  requestId: string,
  decision: "CONFIRM" | "NOT_CONFIRM",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canReviewGaRequestLoss(request.status)) return "Permintaan ini belum siap untuk ditinjau atau sudah diputuskan.";
  if (!request.assetId) return "Permintaan kehilangan ini tidak memiliki aset terkait.";

  const lossReviewNote = (formData.get("lossReviewNote") as string)?.trim() || null;
  const confirmed = decision === "CONFIRM";

  const openCustody = await prisma.assetCustody.findFirst({ where: { assetId: request.assetId, status: { not: "RETURNED" } } });
  const newAssetStatus = assetStatusAfterLossDecision(confirmed, request.status, !!openCustody);

  // GA Admin may attach the loss evidence here if the requester did not.
  let evidenceFileId: string | undefined;
  if (!request.evidenceFileId) {
    const evidenceFile = formData.get("evidenceFile") as File | null;
    if (evidenceFile && evidenceFile.size > 0) {
      const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
      if (validationError) return validationError;
      const storageKey = randomStorageKey("ga-request", getExtension(evidenceFile.name));
      const bytes = Buffer.from(await evidenceFile.arrayBuffer());
      await savePrivateFile(storageKey, bytes);
      const fileObject = await prisma.fileObject.create({
        data: {
          storageKey,
          originalFileName: evidenceFile.name,
          mimeType: evidenceFile.type,
          sizeBytes: evidenceFile.size,
          sensitivity: "RESTRICTED",
          employeeId: request.requesterEmployeeId,
          uploadedByAccountId: session.user.id,
          category: "GA_REQUEST_EVIDENCE",
          confidential: false,
        },
      });
      evidenceFileId = fileObject.id;
    }
  }

  await prisma.$transaction([
    prisma.gaRequest.update({
      where: { id: requestId },
      data: {
        status: decideGaRequestLossStatus(confirmed),
        lossReviewedAt: new Date(),
        lossReviewedByAccountId: session.user.id,
        lossReviewNote,
        ...(evidenceFileId ? { evidenceFileId } : {}),
      },
    }),
    ...(newAssetStatus ? [prisma.fixedAsset.update({ where: { id: request.assetId }, data: { status: newAssetStatus } })] : []),
    ...(confirmed && openCustody
      ? [
          prisma.assetCustody.update({
            where: { id: openCustody.id },
            data: {
              status: "RETURNED",
              returnedAt: new Date(),
              returnedByAccountId: session.user.id,
              returnConditionNote: "Ditutup otomatis — kehilangan aset dikonfirmasi.",
              inspectionResult: "LOST_OR_BEYOND_REPAIR",
            },
          }),
        ]
      : []),
  ]);

  if (confirmed) {
    await createDisposalCaseInternal({
      assetId: request.assetId,
      reason: "CONFIRMED_LOSS",
      createdByAccountId: session.user.id,
      sourceGaRequestId: request.id,
      proposalNote: lossReviewNote,
    });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} loss review: ${confirmed ? "confirmed" : "not confirmed"}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  revalidatePath(`/assets/${request.assetId}`);
  if (confirmed) revalidatePath("/disposal-cases");
  return undefined;
}

// Cancelling a LOSS request that already moved the asset to
// LOST_PENDING_REVIEW (status PENDING_LOSS_REVIEW) must also revert the
// asset — otherwise it stays stuck at that status forever with no review
// left to resolve it (verifyGaRequest already moved it out of normal
// circulation; cancelling the request that caused that is the review
// ending, same as an explicit NOT_CONFIRM outcome would).
export async function cancelGaRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canCancelGaRequest(session, request.requesterEmployeeId)) return "Anda tidak memiliki akses untuk membatalkan permintaan ini.";
  if (!canCancelGaRequestStatus(request.status)) return "Permintaan yang sudah diproses tidak dapat dibatalkan.";

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  const needsAssetRevert = request.requestType === "LOSS" && request.status === "PENDING_LOSS_REVIEW" && !!request.assetId;
  const openCustody = needsAssetRevert
    ? await prisma.assetCustody.findFirst({ where: { assetId: request.assetId!, status: { not: "RETURNED" } } })
    : null;

  await prisma.$transaction([
    prisma.gaRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByAccountId: session.user.id, cancellationReason },
    }),
    ...(needsAssetRevert
      ? [
          prisma.fixedAsset.update({
            where: { id: request.assetId! },
            data: { status: computeAssetStatusAfterLossReview(false, !!openCustody) },
          }),
        ]
      : []),
  ]);

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} cancelled: ${cancellationReason}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  return undefined;
}

import { prisma } from "@/lib/db";
import { companyYear, companyToday, DAY_MS } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { logAudit } from "@/lib/audit";
import { formatWorkOrderNumber } from "@/lib/ga-operations";
import type { MaintenanceSourceType, MaintenanceWorkType } from "@/generated/prisma/enums";

// The ONE creator for every work order, whether a person clicked a button or the system
// opened it: a damage report accepted, an asset returned as needs-repair, a preventive plan
// that came due. Same "one internal creator" pattern as createDisposalCaseInternal.
export async function createWorkOrderInternal(params: {
  assetId: string;
  sourceType: MaintenanceSourceType;
  sourcePlanId?: string | null;
  sourceGaRequestId?: string | null;
  workType: MaintenanceWorkType;
  checklistNotes?: string | null;
  createdByAccountId: string;
  /** Why it was created, for the audit line (defaults to the source type). */
  auditNote?: string;
}): Promise<{ id: string; workOrderNumber: string }> {
  const year = companyYear();
  const seq = await nextSequence(`WO-${year}`);
  const workOrderNumber = formatWorkOrderNumber(seq, year);

  const workOrder = await prisma.maintenanceWorkOrder.create({
    data: {
      workOrderNumber,
      assetId: params.assetId,
      sourceType: params.sourceType,
      sourcePlanId: params.sourcePlanId ?? null,
      sourceGaRequestId: params.sourceGaRequestId ?? null,
      workType: params.workType,
      checklistNotes: params.checklistNotes ?? null,
      createdByAccountId: params.createdByAccountId,
    },
  });

  await logAudit({
    actorAccountId: params.createdByAccountId,
    action: "CREATE",
    datasetName: "MaintenanceWorkOrder",
    recordId: workOrder.id,
    reason: `${workOrderNumber} created (${params.auditNote ?? params.sourceType.toLowerCase()})`,
  });

  return { id: workOrder.id, workOrderNumber };
}

// An asset that is returned as "needs repair" (from its page or at offboarding clearance) gets a
// corrective work order straight away, unless one is already open for it, so the repair is
// never left without a record.
export async function openRepairForReturnedAsset(params: {
  assetId: string;
  createdByAccountId: string;
  note: string;
}): Promise<{ id: string; workOrderNumber: string } | null> {
  const open = await prisma.maintenanceWorkOrder.findFirst({ where: { assetId: params.assetId, status: "OPEN" }, select: { id: true } });
  if (open) return null;
  return createWorkOrderInternal({
    assetId: params.assetId,
    sourceType: "CORRECTIVE",
    workType: "INTERNAL",
    checklistNotes: params.note,
    createdByAccountId: params.createdByAccountId,
    auditNote: "corrective, opened automatically from a return",
  });
}

// Run every morning (see /api/cron/daily): each active plan that is set to open its own work
// order, and is due today or earlier, gets a preventive work order, unless one from that
// plan is still open. Safe to run more than once a day.
export async function createDueMaintenanceWorkOrders(now: Date = new Date()): Promise<{ created: number }> {
  const today = companyToday(now);
  const endOfToday = new Date(today.getTime() + DAY_MS - 1);
  const plans = await prisma.maintenancePlan.findMany({
    where: { activeFlag: true, autoCreateWorkOrder: true, dueDate: { lte: endOfToday } },
    select: { id: true, assetId: true, description: true, createdByAccountId: true },
  });

  let created = 0;
  for (const plan of plans) {
    const open = await prisma.maintenanceWorkOrder.findFirst({ where: { sourcePlanId: plan.id, status: "OPEN" }, select: { id: true } });
    if (open) continue;
    await createWorkOrderInternal({
      assetId: plan.assetId,
      sourceType: "PREVENTIVE",
      sourcePlanId: plan.id,
      workType: "INTERNAL",
      checklistNotes: plan.description,
      createdByAccountId: plan.createdByAccountId,
      auditNote: "preventive, opened automatically when the plan came due",
    });
    created += 1;
  }
  return { created };
}

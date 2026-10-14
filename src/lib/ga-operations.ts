// Pure business logic for Phase 4B GA Operations (requests, maintenance,
// disposal). No Prisma/Next imports — unit testable, same pattern as
// assets.ts/offboarding.ts.
import type {
  GaRequestType,
  GaRequestStatus,
  MaintenanceStatus,
  MaintenanceOutcome,
  DisposalStatus,
  DisposalReason,
} from "@/generated/prisma/enums";
import type { AssetStatusValue } from "@/lib/assets";

export function formatGaRequestNumber(sequence: number, year: number): string {
  return `GAR-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatWorkOrderNumber(sequence: number, year: number): string {
  return `WO-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatDisposalCaseNumber(sequence: number, year: number): string {
  return `DSP-${year}-${String(sequence).padStart(4, "0")}`;
}

// ---------- GaRequest ----------

export function canVerifyGaRequest(status: GaRequestStatus): boolean {
  return status === "SUBMITTED";
}

// PDF "Request type?" routing, evaluated at verification time.
// - NEW_ASSET_NEED: "Approval required?" — Yes goes to the configured
//   Position, No goes straight through (dashed line in the PDF).
// - DAMAGE_OR_ABNORMAL_CONDITION: "Inspect asset and create corrective work
//   order" — the request itself is done once routed; the work continues as
//   a MaintenanceWorkOrder.
// - LOSS: "Record loss incident and evidence" then always reviewed by the
//   configured Position (no "No" branch shown for this diamond).
export function routeGaRequestAfterVerification(
  requestType: GaRequestType,
  approvalRequired: boolean
): GaRequestStatus {
  if (requestType === "NEW_ASSET_NEED") {
    return approvalRequired ? "PENDING_APPROVAL" : "APPROVED";
  }
  if (requestType === "DAMAGE_OR_ABNORMAL_CONDITION") {
    return "WORK_ORDER_CREATED";
  }
  return "PENDING_LOSS_REVIEW";
}

export function canDecideGaRequest(status: GaRequestStatus): boolean {
  return status === "PENDING_APPROVAL";
}

export function decideGaRequestStatus(approved: boolean): GaRequestStatus {
  return approved ? "APPROVED" : "REJECTED";
}

export function canProcessGaRequest(status: GaRequestStatus): boolean {
  return status === "APPROVED";
}

// A loss report is decided in one step straight from SUBMITTED. PENDING_LOSS_REVIEW is
// the old waiting state, kept so a request left there can still be decided.
export function canReviewGaRequestLoss(status: GaRequestStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_LOSS_REVIEW";
}

// A damage report is accepted (work order opened) or turned down while it is SUBMITTED.
export function canDecideDamageRequest(status: GaRequestStatus): boolean {
  return status === "SUBMITTED";
}

// What the asset becomes when a loss report is decided. A confirmed loss waits for its
// disposal case. A report that is not confirmed leaves the asset alone, unless it was
// blocked by the old verification step, in which case it goes back into circulation.
export function assetStatusAfterLossDecision(
  confirmed: boolean,
  requestStatus: GaRequestStatus,
  hasOpenCustody: boolean
): AssetStatusValue | null {
  if (confirmed) return "PENDING_DISPOSAL";
  if (requestStatus === "PENDING_LOSS_REVIEW") return hasOpenCustody ? "IN_USE" : "AVAILABLE";
  return null;
}

export function decideGaRequestLossStatus(confirmed: boolean): GaRequestStatus {
  return confirmed ? "LOSS_CONFIRMED" : "LOSS_NOT_CONFIRMED";
}

export function canCancelGaRequestStatus(status: GaRequestStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_APPROVAL" || status === "PENDING_LOSS_REVIEW";
}

// ---------- Asset status side effects ----------

export function computeAssetStatusAfterLossReview(confirmed: boolean, hasOpenCustody: boolean): AssetStatusValue {
  if (confirmed) return "LOST_PENDING_REVIEW";
  return hasOpenCustody ? "IN_USE" : "AVAILABLE";
}

// OPERATIONAL returns the asset to normal circulation; BEYOND_REPAIR makes it
// PENDING_DISPOSAL (blocked from assignment) while the auto-drafted
// DisposalCase is open — it only becomes RETIRED once that case executes.
export function computeAssetStatusAfterMaintenanceOutcome(
  outcome: MaintenanceOutcome,
  hasOpenCustody: boolean
): AssetStatusValue {
  if (outcome === "BEYOND_REPAIR") return "PENDING_DISPOSAL";
  return hasOpenCustody ? "IN_USE" : "AVAILABLE";
}

export function computeAssetStatusAfterDisposalExecution(): AssetStatusValue {
  return "RETIRED";
}

// ---------- MaintenancePlan / MaintenanceWorkOrder ----------

export function canExecuteMaintenanceWorkOrder(status: MaintenanceStatus): boolean {
  return status === "OPEN";
}

// ---------- DisposalCase ----------

// A case that is not going ahead can be cancelled until it is executed; the asset goes
// back into circulation.
export function canCancelDisposalCase(status: DisposalStatus): boolean {
  return status === "DRAFT" || status === "PENDING_APPROVAL" || status === "APPROVED";
}

export function computeAssetStatusAfterDisposalCancel(hasOpenCustody: boolean): AssetStatusValue {
  return hasOpenCustody ? "IN_USE" : "AVAILABLE";
}

// PDF: "No: repair, storage or review" — a rejected proposal returns to
// DRAFT (GA Admin can revise and resubmit) rather than being closed out or
// deleted; immutable history, never silently overwritten.
export function decideDisposalCaseStatus(approved: boolean): DisposalStatus {
  return approved ? "APPROVED" : "DRAFT";
}

// Approving a disposal and taking the asset out are one step: the form is open from DRAFT.
// APPROVED and PENDING_APPROVAL are the old waiting states, kept so older cases can still be finished.
export function canExecuteDisposalCase(status: DisposalStatus): boolean {
  return status === "DRAFT" || status === "PENDING_APPROVAL" || status === "APPROVED";
}

export function disposalReasonForMaintenanceOutcome(outcome: MaintenanceOutcome): DisposalReason | null {
  return outcome === "BEYOND_REPAIR" ? "BEYOND_REPAIR" : null;
}

// Offboarding blocker (mirrors assets.ts's blocksOffboarding for
// AssetCustody): a Damage/Loss request the employee submitted still counts
// as an unresolved asset-accountability matter until the request itself
// reaches its own terminal status — WORK_ORDER_CREATED for damage (the
// follow-up repair is tracked separately on the MaintenanceWorkOrder, not
// re-checked here), LOSS_CONFIRMED/LOSS_NOT_CONFIRMED for loss. A
// NEW_ASSET_NEED request never blocks — an unfulfilled equipment request
// isn't an accountability issue, it can simply lapse when the employee
// leaves.
export function blocksOffboardingGaRequest(requestType: GaRequestType, status: GaRequestStatus): boolean {
  if (requestType === "NEW_ASSET_NEED") return false;
  if (requestType === "DAMAGE_OR_ABNORMAL_CONDITION") return status === "SUBMITTED";
  return status === "SUBMITTED" || status === "PENDING_LOSS_REVIEW";
}

// ---------- Preventive plans ----------

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NextPlanDueInput {
  serviceDate: Date;
  odometerKm: number | null;
  intervalDays: number | null;
  intervalKm: number | null;
  /** Typed by GA Admin when recording the work; always wins over the computed value. */
  enteredNextDueDate: Date | null;
  enteredNextDueKm: number | null;
}

// When a work order from a plan is recorded, the plan comes due again one interval later:
// service date plus the day interval, odometer plus the km interval. Whatever GA Admin typed
// wins. Null means "leave that part of the plan alone".
export function computeNextPlanDue(input: NextPlanDueInput): { dueDate: Date | null; dueKm: number | null } {
  const dueDate =
    input.enteredNextDueDate ??
    (input.intervalDays && input.intervalDays > 0 ? new Date(input.serviceDate.getTime() + input.intervalDays * DAY_MS) : null);
  const dueKm =
    input.enteredNextDueKm ??
    (input.intervalKm && input.intervalKm > 0 && input.odometerKm !== null ? input.odometerKm + input.intervalKm : null);
  return { dueDate, dueKm };
}

export type PlanDueState = "NONE" | "LATER" | "SOON" | "OVERDUE";

export const PLAN_DUE_SOON_DAYS = 7;

// daysUntilDue is whole company days from today (negative once late), null when the plan has no date.
export function planDueState(daysUntilDue: number | null): PlanDueState {
  if (daysUntilDue === null) return "NONE";
  if (daysUntilDue < 0) return "OVERDUE";
  if (daysUntilDue <= PLAN_DUE_SOON_DAYS) return "SOON";
  return "LATER";
}

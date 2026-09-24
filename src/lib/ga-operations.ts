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

export function canReviewGaRequestLoss(status: GaRequestStatus): boolean {
  return status === "PENDING_LOSS_REVIEW";
}

export function decideGaRequestLossStatus(confirmed: boolean): GaRequestStatus {
  return confirmed ? "LOSS_CONFIRMED" : "LOSS_NOT_CONFIRMED";
}

export function canCancelGaRequestStatus(status: GaRequestStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_APPROVAL" || status === "PENDING_LOSS_REVIEW";
}

// ---------- Asset status side effects ----------

// GA Admin verifying a DAMAGE_OR_ABNORMAL_CONDITION or LOSS request moves
// the asset out of normal circulation immediately — reuses the existing
// AssetStatus values so isAssetAvailableForIndividualAssignment (Phase 4A,
// unchanged) already blocks new assignment with no extra code.
export function computeAssetStatusAfterGaRequestVerification(
  requestType: GaRequestType
): AssetStatusValue | null {
  if (requestType === "DAMAGE_OR_ABNORMAL_CONDITION") return "UNDER_REPAIR";
  if (requestType === "LOSS") return "LOST_PENDING_REVIEW";
  return null;
}

export function computeAssetStatusAfterLossReview(confirmed: boolean, hasOpenCustody: boolean): AssetStatusValue {
  if (confirmed) return "LOST_PENDING_REVIEW";
  return hasOpenCustody ? "IN_USE" : "AVAILABLE";
}

// OPERATIONAL returns the asset to normal circulation; BEYOND_REPAIR leaves
// it UNDER_REPAIR (blocked from assignment) pending the auto-drafted
// DisposalCase's outcome — it only becomes RETIRED once that case executes.
export function computeAssetStatusAfterMaintenanceOutcome(
  outcome: MaintenanceOutcome,
  hasOpenCustody: boolean
): AssetStatusValue {
  if (outcome === "BEYOND_REPAIR") return "UNDER_REPAIR";
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

export function canSubmitDisposalCaseForApproval(status: DisposalStatus): boolean {
  return status === "DRAFT";
}

export function canDecideDisposalCase(status: DisposalStatus): boolean {
  return status === "PENDING_APPROVAL";
}

// PDF: "No: repair, storage or review" — a rejected proposal returns to
// DRAFT (GA Admin can revise and resubmit) rather than being closed out or
// deleted; immutable history, never silently overwritten.
export function decideDisposalCaseStatus(approved: boolean): DisposalStatus {
  return approved ? "APPROVED" : "DRAFT";
}

export function canExecuteDisposalCase(status: DisposalStatus): boolean {
  return status === "APPROVED";
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

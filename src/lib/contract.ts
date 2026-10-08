// Pure business logic for the Contract + renewal pipeline (WF-10, LIF-08..12,
// Data Fields Blueprint "08 Contracts"). No Prisma/Next imports — unit
// testable with plain values, same pattern as recruitment.ts/movement.ts.
import { DAY_MS } from "@/lib/company-time";
import type { ContractStatus, EmploymentStatus } from "@/generated/prisma/enums";

// Blueprint's own example ("PKWT/CBP/2026/019") uses a 3-digit sequence,
// unlike this app's other request numbers (REQ-/MOV-/ONB- all use 4) — kept
// as the blueprint shows it, since SRC-02 gives it authority over field
// formats.
export function formatContractNumber(contractType: EmploymentStatus, sequence: number, year: number): string {
  return `${contractType}/CBP/${year}/${String(sequence).padStart(3, "0")}`;
}

export type ExpiryUrgency = "NONE" | "DUE_90" | "DUE_60" | "DUE_30" | "DUE_7" | "EXPIRED";

// LIF-10: "configurable reminders at 90, 60, 30 and 7 days before end date,
// plus an expired alert." Only meaningful for an ACTIVE contract with a
// fixed end_date — an indefinite (PKWTT, endDate null) contract never
// expires.
export function computeExpiryUrgency(
  status: ContractStatus,
  endDate: Date | null,
  now: Date = new Date()
): ExpiryUrgency {
  if (status !== "ACTIVE" || !endDate) return "NONE";
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS);
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= 7) return "DUE_7";
  if (daysRemaining <= 30) return "DUE_30";
  if (daysRemaining <= 60) return "DUE_60";
  if (daysRemaining <= 90) return "DUE_90";
  return "NONE";
}

// WF-10: Active -> Review Requested -> Recommendation Submitted ->
// Approved for Renewal/Not Renewed -> (new Contract) Draft -> Released ->
// Signed -> Active, with Ended as the old contract's terminal state.
export function canStartContractReview(status: ContractStatus): boolean {
  return status === "ACTIVE";
}
export function canSubmitContractRecommendation(status: ContractStatus): boolean {
  return status === "REVIEW_REQUESTED";
}
export function canDecideContractRenewal(status: ContractStatus): boolean {
  return status === "RECOMMENDATION_SUBMITTED";
}
export function canCreateRenewalDraft(status: ContractStatus): boolean {
  return status === "APPROVED_FOR_RENEWAL";
}
export function canReleaseContract(status: ContractStatus): boolean {
  return status === "DRAFT";
}
export function canSignContractStatus(status: ContractStatus): boolean {
  return status === "RELEASED";
}
export function canActivateContract(status: ContractStatus): boolean {
  return status === "SIGNED";
}

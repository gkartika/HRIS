// Pure business logic for the Contract Renewal Case flow (DM-15, WF-10..12,
// LIF-08..13). No Prisma/Next imports — unit testable with plain values,
// same pattern as contract.ts/movement.ts. FR-HC-01-07 evaluation logic
// (scores, release/submit guards) now lives in the shared src/lib/
// evaluation.ts, reused by this flow rather than duplicated here (WF-19).
import type { ContractRenewalCaseStatus, RenewalRecommendation, MovementType } from "@/generated/prisma/enums";

export function formatRenewalCaseNumber(sequence: number, year: number): string {
  return `REN-${year}-${String(sequence).padStart(4, "0")}`;
}

// LIF-08: "At 30 days before the current contract end date" — mirrors
// contract.ts's computeExpiryUrgency's DUE_30 cutoff so the trigger fires
// exactly when the existing urgency badge first shows "DUE_30".
export function isRenewalDue(endDate: Date | null, now: Date = new Date()): boolean {
  if (!endDate) return false;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / msPerDay);
  return daysRemaining <= 30;
}

// LIF-09: the primary Department Head may recommend once the case has been
// released for evaluation — AND only once the linked Evaluation itself
// reaches Completed (see evaluation.ts's isEvaluationComplete, checked by
// the caller against the linked Evaluation's own status; this case-status
// check alone is not sufficient).
export function canSubmitDeptHeadRecommendation(status: ContractRenewalCaseStatus): boolean {
  return status === "EVALUATION_SENT";
}

export function canDecideRenewalCase(status: ContractRenewalCaseStatus): boolean {
  return status === "PENDING_HR_MANAGER";
}

const LINKED_MOVEMENT_RECOMMENDATIONS: RenewalRecommendation[] = ["MUTASI", "DEMOSI"];

export function requiresLinkedMovement(recommendation: RenewalRecommendation): boolean {
  return LINKED_MOVEMENT_RECOMMENDATIONS.includes(recommendation);
}

export function recommendationToMovementType(recommendation: RenewalRecommendation): MovementType | null {
  if (recommendation === "MUTASI") return "MUTATION";
  if (recommendation === "DEMOSI") return "DEMOTION";
  return null;
}

const RENEWAL_DURATION_MONTHS: Partial<Record<RenewalRecommendation, number>> = {
  PERPANJANG_3: 3,
  PERPANJANG_6: 6,
  PERPANJANG_12: 12,
};

export function recommendationDurationMonths(recommendation: RenewalRecommendation): number | null {
  return RENEWAL_DURATION_MONTHS[recommendation] ?? null;
}

// WF-12: "may change with mandatory reason" — only when the HR Manager's
// final recommendation actually differs from the Dept Head's.
export function requiresChangeReason(
  deptHeadRecommendation: RenewalRecommendation | null,
  finalRecommendation: RenewalRecommendation
): boolean {
  return deptHeadRecommendation !== null && deptHeadRecommendation !== finalRecommendation;
}

// Pure business logic for the Contract Renewal Case flow (DM-15, DM-26,
// WF-10..12, LIF-08..13). No Prisma/Next imports — unit testable with plain
// values, same pattern as contract.ts/movement.ts.
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

export function canSendRenewalEvaluation(status: ContractRenewalCaseStatus): boolean {
  return status === "TRIGGERED";
}

export function canSubmitRenewalEvaluation(
  status: ContractRenewalCaseStatus,
  alreadySubmittedAt: Date | null
): boolean {
  return status === "EVALUATION_SENT" && !alreadySubmittedAt;
}

export function canSubmitDeptHeadRecommendation(
  status: ContractRenewalCaseStatus,
  p1SubmittedAt: Date | null,
  p2SubmittedAt: Date | null
): boolean {
  return status === "EVALUATION_SENT" && !!p1SubmittedAt && !!p2SubmittedAt;
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

export function isRenewalRecommendation(recommendation: RenewalRecommendation): boolean {
  return recommendationDurationMonths(recommendation) !== null;
}

// WF-12: "may change with mandatory reason" — only when the HR Manager's
// final recommendation actually differs from the Dept Head's.
export function requiresChangeReason(
  deptHeadRecommendation: RenewalRecommendation | null,
  finalRecommendation: RenewalRecommendation
): boolean {
  return deptHeadRecommendation !== null && deptHeadRecommendation !== finalRecommendation;
}

// FR-HC-01-07's form scale — every itemized criterion is scored 2/4/6/8.
export const RENEWAL_SCORE_SCALE = [2, 4, 6, 8] as const;

export function isValidScoreValue(value: number): boolean {
  return (RENEWAL_SCORE_SCALE as readonly number[]).includes(value);
}

// DM-26: "KPI/Productivity... When no KPI/Productivity applies, use Quality
// Orientation, Problem Solving, Communication/Leadership, Technical
// Expertise and Work Discipline" — mutually exclusive, so the itemized
// scores are stored as a single JSON object with whichever branch applies
// left populated (the other's fields stay undefined) rather than ~13
// mostly-null Prisma columns per evaluator.
export interface RenewalEvaluationScores {
  kpiProductivity?: number;
  qualityOrientation?: number;
  problemSolving?: number;
  communicationLeadership?: number;
  technicalExpertise?: number;
  workDiscipline?: number;
  absensi?: number;
  tugasKhusus?: number;
  sp?: number;
  kompetensi?: number;
  companyValues?: number[];
}

/**
 * Total is a straight sum of every populated criterion (company values
 * counted individually) — the form's exact weighting formula isn't known
 * until the real FR-HC-01-07 DOCX is supplied (deferred per WF-12's note
 * that DOCX templates are added later); this is a documented simplification.
 */
export function computeEvaluationTotal(scores: RenewalEvaluationScores): number {
  const { companyValues, ...singleValues } = scores;
  const singles = Object.values(singleValues).filter((v): v is number => typeof v === "number");
  const values = companyValues?.filter((v) => typeof v === "number") ?? [];
  return [...singles, ...values].reduce((sum, v) => sum + v, 0);
}

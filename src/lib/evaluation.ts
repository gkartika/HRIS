// Pure business logic for the shared Evaluation entity (DM-26, DM-27, WF-19,
// ACC-17, LIF-14, PER-07, DEC-020). No Prisma/Next imports — unit testable,
// same pattern as contract-renewal.ts/movement.ts. This is the ONE
// FR-HC-01-07 implementation reused by Contract Renewal, Perubahan Posisi
// (Promosi/Mutasi/Demosi) and Manual HR — "do not keep an embedded
// renewal-only evaluation implementation" (WF-19).
import type { EvaluationStatus, EvaluationPurpose, MovementType } from "@/generated/prisma/enums";

export function formatEvaluationNumber(sequence: number, year: number): string {
  return `EVL-${year}-${String(sequence).padStart(4, "0")}`;
}

// ACC-11/ACC-17: "Draft creation does not start evaluator access or the
// five-working-day deadline" — only a Draft can be released, regardless of
// which workflow created it.
export function canReleaseEvaluationStatus(status: EvaluationStatus): boolean {
  return status === "DRAFT";
}

export function canSubmitEvaluationSlot(status: EvaluationStatus, alreadySubmittedAt: Date | null): boolean {
  return status === "RELEASED" && !alreadySubmittedAt;
}

export function isEvaluationComplete(status: EvaluationStatus): boolean {
  return status === "COMPLETED";
}

// WF-17/ACC-16: "Block Department Head/HR Manager completion until
// evaluation is Completed." A null status (no linked Evaluation at all)
// only ever occurs on a legacy pre-refactor row and must never block —
// there was nothing to wait for when that row was created.
export function isEvaluationGateSatisfied(evaluationStatus: EvaluationStatus | null): boolean {
  return evaluationStatus === null || evaluationStatus === "COMPLETED";
}

// FR-HC-01-07's form scale — every itemized criterion is scored 2/4/6/8.
export const EVALUATION_SCORE_SCALE = [2, 4, 6, 8] as const;

export function isValidScoreValue(value: number): boolean {
  return (EVALUATION_SCORE_SCALE as readonly number[]).includes(value);
}

// DM-26: "KPI/Productivity... When no KPI/Productivity applies, use Quality
// Orientation, Problem Solving, Communication/Leadership, Technical
// Expertise and Work Discipline" — mutually exclusive, so the itemized
// scores are stored as a single JSON object with whichever branch applies
// left populated (the other's fields stay undefined) rather than ~13
// mostly-null Prisma columns per evaluator.
export interface EvaluationScores {
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
export function computeEvaluationTotal(scores: EvaluationScores): number {
  const { companyValues, ...singleValues } = scores;
  const singles = Object.values(singleValues).filter((v): v is number => typeof v === "number");
  const values = companyValues?.filter((v) => typeof v === "number") ?? [];
  return [...singles, ...values].reduce((sum, v) => sum + v, 0);
}

// DM-27/WF-17/LIF-14: every Promosi, Mutasi or Demotasi auto-creates a
// linked Evaluation Draft on submission — no exceptions among the three,
// superseding the old Promosi-only performanceEvaluationRef requirement.
const MOVEMENT_TYPES_REQUIRING_EVALUATION: MovementType[] = ["PROMOTION", "MUTATION", "DEMOTION"];

export function requiresEvaluationForMovementType(movementType: MovementType): boolean {
  return MOVEMENT_TYPES_REQUIRING_EVALUATION.includes(movementType);
}

export function movementTypeToEvaluationPurpose(movementType: MovementType): EvaluationPurpose | null {
  if (movementType === "PROMOTION") return "PROMOTION";
  if (movementType === "MUTATION") return "MUTATION";
  if (movementType === "DEMOTION") return "DEMOTION";
  return null;
}

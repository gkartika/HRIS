// Pure business logic for Phase 3A Competency assessment (COM-07, COM-14).
// No Prisma/Next imports — unit testable, same pattern as evaluation.ts/
// contract-renewal.ts. Formulas below are transcribed verbatim from the
// blueprint's "08 Competency" sheet — do not "simplify" them.

export function formatCycleCode(sequence: number, year: number): string {
  return `CYC-${year}-${String(sequence).padStart(2, "0")}`;
}

// COM-07: "For each required item calculate gap=max(required-actual,0)."
// Only meaningful for a required item that has been scored — callers should
// only call this for isRequired items with a non-null actualLevel.
export function computeCompetencyGap(requiredLevel: number, actualLevel: number): number {
  return Math.max(requiredLevel - actualLevel, 0);
}

export interface CompetencyAchievementItem {
  isRequired: boolean;
  requiredLevel: number | null;
  actualLevel: number | null;
}

// COM-07: "Calculate Competency Achievement %=sum(min(actual,required))/
// sum(required) over required items only and cap at 100%. An Actual above
// target does not increase the score above its requirement." N/A items
// (isRequired=false or requiredLevel=null) are excluded entirely — they are
// not zero-weighted, they simply don't participate. An unscored required
// item (actualLevel still null) counts as 0/not-yet-demonstrated, matching
// COM-04's "0 means below Level 1/not yet demonstrated".
export function computeCompetencyAchievementPct(items: CompetencyAchievementItem[]): number | null {
  const required = items.filter(
    (item): item is CompetencyAchievementItem & { requiredLevel: number } =>
      item.isRequired && item.requiredLevel !== null,
  );
  if (required.length === 0) return null;

  const requiredSum = required.reduce((sum, item) => sum + item.requiredLevel, 0);
  if (requiredSum === 0) return null;

  const achievedSum = required.reduce((sum, item) => sum + Math.min(item.actualLevel ?? 0, item.requiredLevel), 0);
  return Math.min((achievedSum / requiredSum) * 100, 100);
}

export const COMPANY_VALUE_SCORE_SCALE = [0, 25, 50, 75, 100] as const;

export function isValidCompanyValueScore(value: number): boolean {
  return (COMPANY_VALUE_SCORE_SCALE as readonly number[]).includes(value);
}

// COM-14: "Per value use average(P1,P2) × 20%; sum the five values for a
// Company Values Score from 0-100." `weight` is stored as an integer
// percentage (20), so the multiplier is weight/100. Returns null while
// either evaluator hasn't scored yet — a per-value contribution isn't
// computable from a single side.
export function computeCompanyValueItemScore(p1Score: number | null, p2Score: number | null, weight: number): number | null {
  if (p1Score === null || p2Score === null) return null;
  return ((p1Score + p2Score) / 2) * (weight / 100);
}

export interface CompanyValueScoreItem {
  p1Score: number | null;
  p2Score: number | null;
  weightSnapshot: number;
}

// COM-14/COM-13: every eligible Employee is scored on the same five Company
// Values, so a Company Values Score is only meaningful once all five items
// have both P1 and P2 recorded — returns null until then rather than
// reporting a partial sum as if it were final.
export function computeCompanyValuesScore(items: CompanyValueScoreItem[]): number | null {
  const scores = items.map((item) => computeCompanyValueItemScore(item.p1Score, item.p2Score, item.weightSnapshot));
  if (scores.some((s) => s === null)) return null;
  return (scores as number[]).reduce((sum, s) => sum + s, 0);
}

// An assessment is complete only once P1 (competency + Company Values) and
// P2 (Company Values only) have both submitted — COM-06/COM-15.
export function isCompetencyAssessmentComplete(p1SubmittedAt: Date | null, p2SubmittedAt: Date | null): boolean {
  return p1SubmittedAt !== null && p2SubmittedAt !== null;
}

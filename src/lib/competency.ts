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

// Revised per direct request: P2 (Department Head/HR Manager) dropped from
// Company Values scoring entirely — P1 alone × weight/100. The original
// blueprint formula was average(P1,P2) × weight/100 (COM-14); this
// deliberately supersedes it, not a bug. Returns null only while P1 hasn't
// scored yet.
export function computeCompanyValueItemScore(p1Score: number | null, weight: number): number | null {
  if (p1Score === null) return null;
  return p1Score * (weight / 100);
}

export interface CompanyValueScoreItem {
  p1Score: number | null;
  weightSnapshot: number;
}

// Revised per direct request (was COM-14/COM-13 dual-rater): a Company
// Values Score is now meaningful once all five items have a P1 score —
// returns null until then rather than reporting a partial sum as final.
export function computeCompanyValuesScore(items: CompanyValueScoreItem[]): number | null {
  const scores = items.map((item) => computeCompanyValueItemScore(item.p1Score, item.weightSnapshot));
  if (scores.some((s) => s === null)) return null;
  return (scores as number[]).reduce((sum, s) => sum + s, 0);
}


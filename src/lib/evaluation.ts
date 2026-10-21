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

// An evaluation has one required evaluator (P1) and an optional second one (P2). It is complete when every
// evaluator that was assigned has submitted.
export function allAssignedEvaluatorsSubmitted(slots: {
  p1EmployeeId: string | null;
  p1SubmittedAt: Date | null;
  p2EmployeeId: string | null;
  p2SubmittedAt: Date | null;
}): boolean {
  if (!slots.p1EmployeeId) return false;
  if (!slots.p1SubmittedAt) return false;
  return !slots.p2EmployeeId || !!slots.p2SubmittedAt;
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

// ---------- the evaluation matrix (from 2026-10-21) ----------
// Two sections. Performance: six criteria, each graded 2, 4, 6 or 8. Tata Nilai: five company values, each graded
// 0, 25, 50, 75 or 100. The result is shown as two separate results (performance total and percentage of the
// maximum, and the average of the tata nilai); there is no single combined number.
export const PERFORMANCE_CRITERIA = ["kualitasKerja", "komunikasi", "pemecahanMasalah", "pengambilanKeputusan", "kepemimpinan", "keahlianTeknis"] as const;
export const TATA_NILAI_CRITERIA = ["melayani", "jujur", "rencana", "kemajuan", "legenda"] as const;
export const PERFORMANCE_SCALE = [2, 4, 6, 8] as const;
export const TATA_NILAI_SCALE = [0, 25, 50, 75, 100] as const;

export type PerformanceKey = (typeof PERFORMANCE_CRITERIA)[number];
export type TataNilaiKey = (typeof TATA_NILAI_CRITERIA)[number];

export interface EvaluationMatrixScores {
  version: 2;
  performance: Record<PerformanceKey, number>;
  tataNilai: Record<TataNilaiKey, number>;
}

export const PERFORMANCE_MAX_TOTAL = PERFORMANCE_CRITERIA.length * Math.max(...PERFORMANCE_SCALE);

// Names of the form fields: perf_<key> and tata_<key>.
export const performanceField = (key: PerformanceKey) => `perf_${key}`;
export const tataNilaiField = (key: TataNilaiKey) => `tata_${key}`;

export function isMatrixScores(value: unknown): value is EvaluationMatrixScores {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 2;
}

// Reads the submitted form. Every one of the 11 grades is required and must be on its own scale.
export function parseEvaluationMatrix(
  read: (field: string) => string | null | undefined
): { ok: true; scores: EvaluationMatrixScores; performanceTotal: number } | { ok: false; error: string } {
  const performance = {} as Record<PerformanceKey, number>;
  const tataNilai = {} as Record<TataNilaiKey, number>;
  for (const key of PERFORMANCE_CRITERIA) {
    const raw = (read(performanceField(key)) ?? "").trim();
    const n = Number(raw);
    if (!raw || !(PERFORMANCE_SCALE as readonly number[]).includes(n)) return { ok: false, error: "Semua penilaian Performance wajib diisi dengan nilai 2, 4, 6 atau 8." };
    performance[key] = n;
  }
  for (const key of TATA_NILAI_CRITERIA) {
    const raw = (read(tataNilaiField(key)) ?? "").trim();
    const n = Number(raw);
    if (!raw || !(TATA_NILAI_SCALE as readonly number[]).includes(n)) return { ok: false, error: "Semua penilaian Tata Nilai wajib diisi dengan nilai 0, 25, 50, 75 atau 100." };
    tataNilai[key] = n;
  }
  const scores: EvaluationMatrixScores = { version: 2, performance, tataNilai };
  return { ok: true, scores, performanceTotal: performanceSummary(scores).total };
}

export function performanceSummary(scores: Pick<EvaluationMatrixScores, "performance">): { total: number; max: number; percent: number } {
  const sum = PERFORMANCE_CRITERIA.reduce((acc, key) => acc + (scores.performance[key] ?? 0), 0);
  // an average of two evaluators can have a decimal (e.g. 40.5)
  const total = Math.round(sum * 10) / 10;
  return { total, max: PERFORMANCE_MAX_TOTAL, percent: Math.round((sum / PERFORMANCE_MAX_TOTAL) * 1000) / 10 };
}

// The final result when two evaluators submitted: the average of their grades, criterion by criterion. With one
// evaluator it is simply their grades.
export function averageMatrixScores(list: EvaluationMatrixScores[]): EvaluationMatrixScores | null {
  if (list.length === 0) return null;
  const mean = (values: number[]) => Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const performance = {} as Record<PerformanceKey, number>;
  const tataNilai = {} as Record<TataNilaiKey, number>;
  for (const key of PERFORMANCE_CRITERIA) performance[key] = mean(list.map((s) => s.performance[key]));
  for (const key of TATA_NILAI_CRITERIA) tataNilai[key] = mean(list.map((s) => s.tataNilai[key]));
  return { version: 2, performance, tataNilai };
}

export function tataNilaiAverage(scores: Pick<EvaluationMatrixScores, "tataNilai">): number {
  const sum = TATA_NILAI_CRITERIA.reduce((acc, key) => acc + (scores.tataNilai[key] ?? 0), 0);
  return Math.round((sum / TATA_NILAI_CRITERIA.length) * 10) / 10;
}

// DM-26 (the form used until 2026-10-21, still shown for evaluations already submitted with it): "KPI/Productivity... When no KPI/Productivity applies, use Quality
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

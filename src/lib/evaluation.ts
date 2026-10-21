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
// Two sections. Performance: criteria graded 2, 4, 6 or 8. Tata Nilai: criteria graded 0, 25, 50, 75 or 100. The
// grades of each section are fixed here; Admin SDM edits the criteria themselves (names, order, on/off) in
// Pengaturan Evaluasi. The result is shown as two separate results (performance total and percentage of the
// maximum, and the average of the tata nilai); there is no single combined number.
//
// Each evaluation is released with a copy of the criteria (the "definition"), so a later change to the matrix
// never alters an evaluation already under way. A saved grade is stored under its criterion's key.
export const PERFORMANCE_SCALE = [2, 4, 6, 8] as const;
export const TATA_NILAI_SCALE = [0, 25, 50, 75, 100] as const;

export interface MatrixCriterion {
  key: string;
  label: string;
}

export interface MatrixDefinition {
  performance: MatrixCriterion[];
  tataNilai: MatrixCriterion[];
}

// The criteria used before the matrix became editable (and the starting point of Pengaturan Evaluasi).
export const DEFAULT_MATRIX: MatrixDefinition = {
  performance: [
    { key: "kualitasKerja", label: "Kualitas Kerja" },
    { key: "komunikasi", label: "Komunikasi & Kolaborasi" },
    { key: "pemecahanMasalah", label: "Pemecahan Masalah" },
    { key: "pengambilanKeputusan", label: "Pengambilan Keputusan" },
    { key: "kepemimpinan", label: "Kepemimpinan" },
    { key: "keahlianTeknis", label: "Keahlian Teknis Pekerjaan" },
  ],
  tataNilai: [
    { key: "melayani", label: "Melayani Sepenuh Hati" },
    { key: "jujur", label: "Bangga Berbuat Jujur" },
    { key: "rencana", label: "Rencanakan apa yang dilakukan, lakukanlah apa yang sudah direncanakan" },
    { key: "kemajuan", label: "Tiada hari tanpa kemajuan" },
    { key: "legenda", label: "Bersama kita membuat legenda" },
  ],
};

export interface EvaluationMatrixScores {
  version: 2;
  performance: Record<string, number>;
  tataNilai: Record<string, number>;
}

export const PERFORMANCE_MAX_PER_CRITERION = Math.max(...PERFORMANCE_SCALE);

export function performanceMaxTotal(definition: MatrixDefinition): number {
  return definition.performance.length * PERFORMANCE_MAX_PER_CRITERION;
}

// Names of the form fields: perf_<key> and tata_<key>.
export const performanceField = (key: string) => `perf_${key}`;
export const tataNilaiField = (key: string) => `tata_${key}`;

export function isMatrixScores(value: unknown): value is EvaluationMatrixScores {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 2;
}

function isCriterionList(value: unknown): value is MatrixCriterion[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((c) => typeof c === "object" && c !== null && typeof (c as MatrixCriterion).key === "string" && typeof (c as MatrixCriterion).label === "string")
  );
}

// The criteria an evaluation was released with; the original ones for an evaluation released before the matrix
// could be edited.
export function matrixDefinitionOf(snapshot: unknown): MatrixDefinition {
  if (typeof snapshot === "object" && snapshot !== null) {
    const s = snapshot as { performance?: unknown; tataNilai?: unknown };
    if (isCriterionList(s.performance) && isCriterionList(s.tataNilai)) {
      return { performance: s.performance.map(({ key, label }) => ({ key, label })), tataNilai: s.tataNilai.map(({ key, label }) => ({ key, label })) };
    }
  }
  return DEFAULT_MATRIX;
}

// The copy stored on an evaluation when it is released: the active criteria of each section, in their order.
export function buildMatrixDefinition(criteria: { section: "PERFORMANCE" | "TATA_NILAI"; key: string; label: string; sortOrder: number; active: boolean }[]): MatrixDefinition {
  const pick = (section: "PERFORMANCE" | "TATA_NILAI") =>
    criteria
      .filter((c) => c.section === section && c.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ key, label }) => ({ key, label }));
  return { performance: pick("PERFORMANCE"), tataNilai: pick("TATA_NILAI") };
}

// Reads the submitted form. Every grade of the evaluation's definition is required and must be on its own scale.
export function parseEvaluationMatrix(
  definition: MatrixDefinition,
  read: (field: string) => string | null | undefined
): { ok: true; scores: EvaluationMatrixScores; performanceTotal: number } | { ok: false; error: string } {
  const performance: Record<string, number> = {};
  const tataNilai: Record<string, number> = {};
  for (const { key } of definition.performance) {
    const raw = (read(performanceField(key)) ?? "").trim();
    const n = Number(raw);
    if (!raw || !(PERFORMANCE_SCALE as readonly number[]).includes(n)) return { ok: false, error: "Semua penilaian Performance wajib diisi dengan nilai 2, 4, 6 atau 8." };
    performance[key] = n;
  }
  for (const { key } of definition.tataNilai) {
    const raw = (read(tataNilaiField(key)) ?? "").trim();
    const n = Number(raw);
    if (!raw || !(TATA_NILAI_SCALE as readonly number[]).includes(n)) return { ok: false, error: "Semua penilaian Tata Nilai wajib diisi dengan nilai 0, 25, 50, 75 atau 100." };
    tataNilai[key] = n;
  }
  const scores: EvaluationMatrixScores = { version: 2, performance, tataNilai };
  return { ok: true, scores, performanceTotal: performanceSummary(scores, definition).total };
}

export function performanceSummary(scores: Pick<EvaluationMatrixScores, "performance">, definition: MatrixDefinition): { total: number; max: number; percent: number } {
  const sum = definition.performance.reduce((acc, { key }) => acc + (scores.performance[key] ?? 0), 0);
  const max = performanceMaxTotal(definition);
  // an average of two evaluators can have a decimal (e.g. 40.5)
  return { total: Math.round(sum * 10) / 10, max, percent: max === 0 ? 0 : Math.round((sum / max) * 1000) / 10 };
}

export function tataNilaiAverage(scores: Pick<EvaluationMatrixScores, "tataNilai">, definition: MatrixDefinition): number {
  if (definition.tataNilai.length === 0) return 0;
  const sum = definition.tataNilai.reduce((acc, { key }) => acc + (scores.tataNilai[key] ?? 0), 0);
  return Math.round((sum / definition.tataNilai.length) * 10) / 10;
}

// The final result when two evaluators submitted: the average of their grades, criterion by criterion. With one
// evaluator it is simply their grades.
export function averageMatrixScores(list: EvaluationMatrixScores[], definition: MatrixDefinition): EvaluationMatrixScores | null {
  if (list.length === 0) return null;
  const mean = (values: number[]) => Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const performance: Record<string, number> = {};
  const tataNilai: Record<string, number> = {};
  for (const { key } of definition.performance) performance[key] = mean(list.map((s) => s.performance[key] ?? 0));
  for (const { key } of definition.tataNilai) tataNilai[key] = mean(list.map((s) => s.tataNilai[key] ?? 0));
  return { version: 2, performance, tataNilai };
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

// DM-27/WF-17/LIF-14: every Promosi or Demosi auto-creates a linked Evaluation Draft on submission,
// superseding the old Promosi-only performanceEvaluationRef requirement. Since 2026-10-21 a Mutasi needs
// no evaluation (owner's decision): nothing is created and nothing waits on one.
const MOVEMENT_TYPES_REQUIRING_EVALUATION: MovementType[] = ["PROMOTION", "DEMOTION"];

export function requiresEvaluationForMovementType(movementType: MovementType): boolean {
  return MOVEMENT_TYPES_REQUIRING_EVALUATION.includes(movementType);
}

export function movementTypeToEvaluationPurpose(movementType: MovementType): EvaluationPurpose | null {
  if (movementType === "PROMOTION") return "PROMOTION";
  // MUTATION is kept for evaluations created for a Mutasi before 2026-10-21
  if (movementType === "MUTATION") return "MUTATION";
  if (movementType === "DEMOTION") return "DEMOTION";
  return null;
}

// Pure logic of the recruitment assessment "Tes Situasi Kerja" (behavioral risk screening):
// validation of the master data, the rubric life cycle and the deterministic scoring.
// No Prisma and no Next.js imports on purpose, so everything here is unit tested with plain data.
//
// This is a first-stage screening aid. It never rejects or advances a candidate, and it does not
// diagnose personality: every answer is read from the HR-approved rubric, nothing is generated.

export const ASSESSMENT_ENGINE_VERSION = "1.0";

export const OPTION_KEYS = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export type RiskSignal = 0 | -1 | -2;
export const RISK_SIGNALS: RiskSignal[] = [0, -1, -2];

export type ScreeningStatus = "INCOMPLETE" | "NO_AGGREGATE_CONCERN" | "INTERVIEW_ATTENTION" | "PRIORITY_REVIEW";
export type RubricStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "ARCHIVED";

export const EXPECTED = {
  questions: 20,
  optionsPerQuestion: 4,
  interpretations: 80,
  scoreZero: 58,
  scoreMinusOne: 14,
  scoreMinusTwo: 8,
  minTotal: -19,
} as const;

// The approved provisional V3.2 score matrix, kept apart from the rubric file on purpose:
// it is the independent cross-check of the reference data. Rows are questions 1..20, columns A..D.
export const V32_REFERENCE_MATRIX: Record<number, [RiskSignal, RiskSignal, RiskSignal, RiskSignal]> = {
  1: [0, 0, 0, -1],
  2: [0, 0, -1, -2],
  3: [0, 0, 0, -1],
  4: [0, 0, 0, 0],
  5: [0, 0, 0, -2],
  6: [0, 0, 0, 0],
  7: [0, 0, 0, 0],
  8: [0, 0, -1, -1],
  9: [0, -1, -1, 0],
  10: [0, 0, 0, 0],
  11: [-2, 0, -1, 0],
  12: [-2, 0, 0, -1],
  13: [0, 0, 0, 0],
  14: [-1, -2, 0, 0],
  15: [-1, 0, -1, -2],
  16: [0, 0, 0, 0],
  17: [0, 0, -1, -1],
  18: [0, 0, 0, 0],
  19: [-2, 0, 0, -2],
  20: [0, 0, 0, 0],
};

export const DEFAULT_THRESHOLDS = {
  interviewAttentionAtOrBelow: -3,
  priorityReviewAtOrBelow: -6,
} as const;

// ---------- the two source files ----------

export interface BankOptionFile {
  key: string;
  text: string;
}
export interface BankQuestionFile {
  questionId: number;
  questionCode: string;
  scenario: string;
  prompt: string;
  options: BankOptionFile[];
}
export interface QuestionBankFile {
  assessmentVersion: string;
  name: string;
  organization: string;
  language: string;
  instructions: string[];
  estimatedDurationMinutes: { min: number; max: number };
  closingText: string;
  questions: BankQuestionFile[];
}

export interface InterpretationFile {
  questionId: number;
  optionKey: string;
  assessmentType: string;
  primaryDimension: string;
  behavioralObservation: string;
  riskSignal: number;
  requiresControlReview: boolean;
}
export interface RubricFile {
  assessmentVersion: string;
  rubricVersion: string;
  publicationStatus: string;
  approvalNote: string;
  riskSignalLegend: Record<string, string>;
  thresholds: Record<string, unknown>;
  interpretations: InterpretationFile[];
}

const blank = (s: unknown) => typeof s !== "string" || s.trim() === "";
const keyOf = (questionNo: number, optionKey: string) => `${questionNo}${optionKey}`;

/** Problems with the question bank: 20 questions in order, four distinct options A-D, no empty text. */
export function validateQuestionBank(bank: QuestionBankFile): string[] {
  const problems: string[] = [];
  if (blank(bank.assessmentVersion)) problems.push("Versi asesmen kosong.");
  if (bank.questions.length !== EXPECTED.questions) problems.push(`Jumlah soal ${bank.questions.length}, seharusnya ${EXPECTED.questions}.`);
  bank.questions.forEach((q, i) => {
    if (q.questionId !== i + 1) problems.push(`Soal urutan ${i + 1} bernomor ${q.questionId}.`);
    if (blank(q.scenario) || blank(q.prompt)) problems.push(`Soal ${q.questionId}: situasi atau pertanyaan kosong.`);
    const keys = q.options.map((o) => o.key);
    if (keys.join("") !== OPTION_KEYS.join("")) problems.push(`Soal ${q.questionId}: pilihan harus A, B, C, D (ada ${keys.join(",")}).`);
    const texts = q.options.map((o) => (o.text ?? "").trim());
    if (texts.some((x) => x === "")) problems.push(`Soal ${q.questionId}: ada pilihan kosong.`);
    if (new Set(texts).size !== texts.length) problems.push(`Soal ${q.questionId}: pilihan tidak boleh sama.`);
  });
  return problems;
}

export interface InterpretationLike {
  questionNo: number;
  optionKey: string;
  riskSignal: number;
  observation: string;
  primaryDimension: string;
}

/** Problems with any set of interpretations: one per option, a valid signal, text present, one dimension per question. */
export function validateInterpretations(items: InterpretationLike[]): string[] {
  const problems: string[] = [];
  if (items.length !== EXPECTED.interpretations) problems.push(`Jumlah interpretasi ${items.length}, seharusnya ${EXPECTED.interpretations}.`);
  const seen = new Set<string>();
  const dims = new Map<number, Set<string>>();
  for (const it of items) {
    const k = keyOf(it.questionNo, it.optionKey);
    if (seen.has(k)) problems.push(`Interpretasi ganda untuk soal ${it.questionNo} pilihan ${it.optionKey}.`);
    seen.add(k);
    if (!V32_REFERENCE_MATRIX[it.questionNo] || !(OPTION_KEYS as readonly string[]).includes(it.optionKey)) problems.push(`Soal ${it.questionNo} pilihan ${it.optionKey} tidak dikenal.`);
    if (!(RISK_SIGNALS as number[]).includes(it.riskSignal)) problems.push(`Soal ${it.questionNo}${it.optionKey}: nilai risiko ${it.riskSignal} tidak valid (harus 0, -1, atau -2).`);
    if (blank(it.observation)) problems.push(`Soal ${it.questionNo}${it.optionKey}: observasi perilaku kosong.`);
    if (blank(it.primaryDimension)) problems.push(`Soal ${it.questionNo}${it.optionKey}: dimensi utama kosong.`);
    (dims.get(it.questionNo) ?? dims.set(it.questionNo, new Set()).get(it.questionNo)!).add(it.primaryDimension);
  }
  for (let q = 1; q <= EXPECTED.questions; q++) {
    for (const key of OPTION_KEYS) if (!seen.has(keyOf(q, key))) problems.push(`Soal ${q} pilihan ${key} belum punya interpretasi.`);
  }
  for (const [q, set] of dims) if (set.size > 1) problems.push(`Soal ${q} punya lebih dari satu dimensi utama.`);
  return problems;
}

export interface MatrixDifference {
  questionNo: number;
  optionKey: string;
  rubricValue: number;
  matrixValue: number;
}

/** Options whose risk signal differs from the approved V3.2 score matrix. */
export function matrixDifferences(items: InterpretationLike[], matrix = V32_REFERENCE_MATRIX): MatrixDifference[] {
  const diffs: MatrixDifference[] = [];
  for (const it of items) {
    const expected = matrix[it.questionNo]?.[OPTION_KEYS.indexOf(it.optionKey as OptionKey)];
    if (expected !== undefined && expected !== it.riskSignal) diffs.push({ questionNo: it.questionNo, optionKey: it.optionKey, rubricValue: it.riskSignal, matrixValue: expected });
  }
  return diffs;
}

export function scoreDistribution(items: { riskSignal: number }[]) {
  return {
    zero: items.filter((i) => i.riskSignal === 0).length,
    minusOne: items.filter((i) => i.riskSignal === -1).length,
    minusTwo: items.filter((i) => i.riskSignal === -2).length,
  };
}

/** Problems with the 58 / 14 / 8 totals. */
export function validateScoreTotals(items: { riskSignal: number }[]): string[] {
  const d = scoreDistribution(items);
  const problems: string[] = [];
  if (d.zero !== EXPECTED.scoreZero) problems.push(`Opsi bernilai 0: ${d.zero}, seharusnya ${EXPECTED.scoreZero}.`);
  if (d.minusOne !== EXPECTED.scoreMinusOne) problems.push(`Opsi bernilai -1: ${d.minusOne}, seharusnya ${EXPECTED.scoreMinusOne}.`);
  if (d.minusTwo !== EXPECTED.scoreMinusTwo) problems.push(`Opsi bernilai -2: ${d.minusTwo}, seharusnya ${EXPECTED.scoreMinusTwo}.`);
  return problems;
}

export interface PackageValidation {
  ok: boolean;
  problems: string[];
}

/**
 * Cross-checks the whole package before it is imported: the bank, the rubric, that the two describe the
 * same version and options, the approved score matrix and the 58/14/8 totals. Publication stops on any
 * problem; nothing is corrected automatically.
 */
export function validateAssessmentPackage(bank: QuestionBankFile, rubric: RubricFile): PackageValidation {
  const problems: string[] = [...validateQuestionBank(bank)];
  if (bank.assessmentVersion !== rubric.assessmentVersion) problems.push(`Versi asesmen berbeda: bank ${bank.assessmentVersion}, rubrik ${rubric.assessmentVersion}.`);
  const items: InterpretationLike[] = rubric.interpretations.map((r) => ({
    questionNo: r.questionId,
    optionKey: r.optionKey,
    riskSignal: r.riskSignal,
    observation: r.behavioralObservation,
    primaryDimension: r.primaryDimension,
  }));
  problems.push(...validateInterpretations(items));
  problems.push(...validateScoreTotals(items));
  for (const d of matrixDifferences(items)) {
    problems.push(`Tidak sesuai matriks: soal ${d.questionNo}${d.optionKey} bernilai ${d.rubricValue} di rubrik, ${d.matrixValue} di matriks.`);
  }
  const bankKeys = new Set(bank.questions.flatMap((q) => q.options.map((o) => keyOf(q.questionId, o.key))));
  for (const r of rubric.interpretations) if (!bankKeys.has(keyOf(r.questionId, r.optionKey))) problems.push(`Rubrik memuat soal ${r.questionId}${r.optionKey} yang tidak ada di bank soal.`);
  if (blank(rubric.rubricVersion)) problems.push("Versi rubrik kosong.");
  return { ok: problems.length === 0, problems };
}

// ---------- rubric life cycle ----------

export type RubricAction = "SUBMIT" | "RETURN" | "APPROVE" | "ACTIVATE" | "ARCHIVE";

const TRANSITIONS: Record<RubricAction, { from: RubricStatus[]; to: RubricStatus }> = {
  SUBMIT: { from: ["DRAFT"], to: "PENDING_APPROVAL" },
  // Rejecting and returning are the same step: the rubric is editable again, history stays.
  RETURN: { from: ["PENDING_APPROVAL"], to: "DRAFT" },
  APPROVE: { from: ["PENDING_APPROVAL"], to: "APPROVED" },
  ACTIVATE: { from: ["APPROVED"], to: "ACTIVE" },
  ARCHIVE: { from: ["APPROVED", "ACTIVE"], to: "ARCHIVED" },
};

export function nextRubricStatus(from: RubricStatus, action: RubricAction): RubricStatus | null {
  const rule = TRANSITIONS[action];
  return rule.from.includes(from) ? rule.to : null;
}

/** Only a draft can be edited. Once approved, content and scores are locked for good. */
export function isRubricEditable(status: RubricStatus): boolean {
  return status === "DRAFT";
}

/** A rubric may be used for official scoring only after an HR Manager approved it. */
export function isRubricUsableForScoring(rubric: { status: RubricStatus; approvedAt: Date | null }): boolean {
  return rubric.approvedAt !== null && (rubric.status === "APPROVED" || rubric.status === "ACTIVE" || rubric.status === "ARCHIVED");
}

/** "V3.2-R1" -> next is "V3.2-R2": one more than the highest R number of that assessment version. */
export function nextRubricLabel(assessmentVersion: string, existingLabels: string[]): string {
  const prefix = `${assessmentVersion}-R`;
  const highest = existingLabels.reduce((max, label) => {
    const n = label.startsWith(prefix) ? Number(label.slice(prefix.length)) : NaN;
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${highest + 1}`;
}

// ---------- deterministic scoring ----------

export function screeningStatusFor(total: number): Exclude<ScreeningStatus, "INCOMPLETE"> {
  if (total <= DEFAULT_THRESHOLDS.priorityReviewAtOrBelow) return "PRIORITY_REVIEW";
  if (total <= DEFAULT_THRESHOLDS.interviewAttentionAtOrBelow) return "INTERVIEW_ATTENTION";
  return "NO_AGGREGATE_CONCERN";
}

export interface ScoringInterpretation {
  id: string;
  optionId: string;
  questionNo: number;
  optionKey: string;
  assessmentType: string;
  primaryDimension: string;
  observation: string;
  riskSignal: number;
  requiresControlReview: boolean;
}

export interface ScoringQuestion {
  id: string;
  questionNo: number;
}

export interface ScoringInput {
  rubric: { id: string; status: RubricStatus; approvedAt: Date | null };
  questions: ScoringQuestion[];
  /** questionId -> chosen optionId */
  answers: Map<string, string>;
  /** optionId -> the rubric's interpretation of that option */
  interpretations: Map<string, ScoringInterpretation>;
}

export interface ScoredItem {
  questionId: string;
  questionNo: number;
  optionId: string;
  rubricId: string;
  interpretation: ScoringInterpretation;
}

export type ScoringResult =
  | { status: "INCOMPLETE"; total: null; answered: number; missingQuestionNos: number[] }
  | { status: Exclude<ScreeningStatus, "INCOMPLETE">; total: number; items: ScoredItem[] };

export class RubricNotApprovedError extends Error {
  constructor() {
    super("Rubrik ini belum disetujui HR Manager, sehingga tidak dapat dipakai untuk penilaian resmi.");
  }
}

/**
 * Assessment version + question + selected option + approved rubric -> interpretation and risk signal.
 * Each of the 20 questions counts exactly once. An incomplete assessment gets no score. An answer that
 * the rubric has no interpretation for is an error, never a silent zero.
 */
export function scoreAssessment(input: ScoringInput): ScoringResult {
  if (!isRubricUsableForScoring(input.rubric)) throw new RubricNotApprovedError();
  const ordered = [...input.questions].sort((a, b) => a.questionNo - b.questionNo);
  const missing = ordered.filter((q) => !input.answers.has(q.id));
  if (ordered.length === 0 || missing.length > 0) {
    return { status: "INCOMPLETE", total: null, answered: ordered.length - missing.length, missingQuestionNos: missing.map((q) => q.questionNo) };
  }
  const items: ScoredItem[] = ordered.map((q) => {
    const optionId = input.answers.get(q.id)!;
    const interpretation = input.interpretations.get(optionId);
    if (!interpretation || interpretation.questionNo !== q.questionNo) {
      throw new Error(`Rubrik tidak punya interpretasi untuk jawaban soal ${q.questionNo}.`);
    }
    return { questionId: q.id, questionNo: q.questionNo, optionId, rubricId: input.rubric.id, interpretation };
  });
  const total = items.reduce((sum, item) => sum + item.interpretation.riskSignal, 0);
  return { status: screeningStatusFor(total), total, items };
}

/** Answers HR must look at even when the total is above -6: a material signal or a control-review flag. */
export function isMaterialConcern(item: { riskSignal: number; requiresControlReview: boolean }): boolean {
  return item.riskSignal === -2 || item.requiresControlReview;
}

/** A candidate may answer only options of this question. */
export function isOptionOfQuestion(question: { options: { id: string }[] }, optionId: string): boolean {
  return question.options.some((o) => o.id === optionId);
}

// ---------- who may take the assessment, and when ----------

const CLOSED_CANDIDATE_STATUSES = ["TEST_FAILED", "REJECTED", "OFFER_DECLINED", "NOT_SELECTED", "HIRED"];

/**
 * Tes Situasi Kerja is the first test everyone takes (it replaced Cultural Fit), so it is open for every
 * applicant who is still in the process. It is not a pass/fail test and never rejects anyone; it only has to
 * be finished (or closed by the clock) before the applicant's other tests open.
 */
export function isAssessmentOpenFor(candidate: { status: string; closedAt: Date | null }): boolean {
  return candidate.closedAt === null && !CLOSED_CANDIDATE_STATUSES.includes(candidate.status);
}

// ---------- time limit ----------

// The limit is set in the app per assessment (Admin Rekrutmen); this is the starting value and the allowed range.
export const ASSESSMENT_TIME_LIMIT_MINUTES = 30;
export const ASSESSMENT_TIME_LIMIT_MIN = 5;
export const ASSESSMENT_TIME_LIMIT_MAX = 240;

export function isValidTimeLimit(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= ASSESSMENT_TIME_LIMIT_MIN && minutes <= ASSESSMENT_TIME_LIMIT_MAX;
}
// The browser sends the last answer a moment before the clock reaches zero; this much late is still accepted.
export const ASSESSMENT_GRACE_SECONDS = 20;

export function assessmentDeadline(startedAt: Date, limitMinutes: number = ASSESSMENT_TIME_LIMIT_MINUTES): Date {
  return new Date(startedAt.getTime() + limitMinutes * 60 * 1000);
}

/** True once the time limit of that attempt (plus the short grace for slow connections) is over. */
export function isAssessmentExpired(startedAt: Date, now: Date, graceSeconds: number = ASSESSMENT_GRACE_SECONDS, limitMinutes: number = ASSESSMENT_TIME_LIMIT_MINUTES): boolean {
  return now.getTime() > assessmentDeadline(startedAt, limitMinutes).getTime() + graceSeconds * 1000;
}

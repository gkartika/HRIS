// Pure rules for the applicant pipeline (tests, statuses, re-applying, messages).
// No Prisma/Next imports, so everything here is unit testable.
import { randomBytes } from "crypto";
import type {
  RecruitmentCandidateStatus,
  RecruitmentCandidateTestStatus,
  RecruitmentInterviewDecision,
  RecruitmentOpenFor,
  RecruitmentTestForm,
} from "@/generated/prisma/enums";

// ---------- labels ----------

export const CANDIDATE_STATUS_LABEL: Record<RecruitmentCandidateStatus, string> = {
  TESTING: "Sedang tes",
  AWAITING_REVIEW: "Menunggu review",
  TEST_PASSED: "Lolos tes",
  TEST_FAILED: "Tidak lolos tes",
  INTERVIEWING: "Interview",
  OFFERING: "Offering",
  MOVEMENT: "Perubahan posisi",
  HIRED: "Selesai (diterima)",
  REJECTED: "Ditolak",
  OFFER_DECLINED: "Menolak offering",
  NOT_SELECTED: "Tidak terpilih",
};

export const CANDIDATE_STATUS_TONE: Record<RecruitmentCandidateStatus, string> = {
  TESTING: "bg-slate-100 text-slate-600",
  AWAITING_REVIEW: "bg-amber-50 text-amber-700",
  TEST_PASSED: "bg-emerald-50 text-emerald-700",
  TEST_FAILED: "bg-rose-50 text-rose-700",
  INTERVIEWING: "bg-indigo-50 text-indigo-700",
  OFFERING: "bg-amber-50 text-amber-700",
  MOVEMENT: "bg-indigo-50 text-indigo-700",
  HIRED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  OFFER_DECLINED: "bg-rose-50 text-rose-700",
  NOT_SELECTED: "bg-slate-100 text-slate-500",
};

export const OPEN_FOR_LABEL: Record<RecruitmentOpenFor, string> = {
  NONE: "Belum dibuka",
  EXTERNAL: "Eksternal saja",
  INTERNAL: "Internal saja",
  BOTH: "Eksternal dan internal",
};

export const TEST_FORM_LABEL: Record<RecruitmentTestForm, string> = {
  SCALE: "Skala 1-5",
  MULTIPLE_CHOICE: "Pilihan ganda",
  ESSAY: "Esai",
};

export const DECISION_LABEL: Record<RecruitmentInterviewDecision, string> = {
  ACCEPTED: "Diterima",
  CONSIDERED: "Dipertimbangkan",
  REJECTED: "Ditolak",
};

export const DECISION_TONE: Record<RecruitmentInterviewDecision, string> = {
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  CONSIDERED: "bg-amber-50 text-amber-700",
  REJECTED: "bg-rose-50 text-rose-700",
};

export const SCALE_LABELS = ["Sangat tidak setuju", "Tidak setuju", "Netral", "Setuju", "Sangat setuju"];

// ---------- statuses ----------

// Still moving through the pipeline.
export const ACTIVE_CANDIDATE_STATUSES: RecruitmentCandidateStatus[] = [
  "TESTING",
  "AWAITING_REVIEW",
  "TEST_PASSED",
  "INTERVIEWING",
  "OFFERING",
  "MOVEMENT",
];

export function isActiveCandidateStatus(status: RecruitmentCandidateStatus): boolean {
  return ACTIVE_CANDIDATE_STATUSES.includes(status);
}

// Left the pipeline without being hired by their own result or HR's decision. Only
// these make someone wait before applying again.
export const RETAKE_WAIT_STATUSES: RecruitmentCandidateStatus[] = ["TEST_FAILED", "REJECTED"];

// Statuses that count as "closed without a hire" (closedAt is set for them).
export const CLOSED_WITHOUT_HIRE_STATUSES: RecruitmentCandidateStatus[] = [
  "TEST_FAILED",
  "REJECTED",
  "OFFER_DECLINED",
  "NOT_SELECTED",
];

// ---------- applying ----------

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// "0812-3456-7890" / "+62 812 3456 7890" / "62812..." all become "6281234567890".
export function normalizeMobile(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export function isValidMobile(input: string): boolean {
  const n = normalizeMobile(input);
  return n.length >= 10 && n.length <= 15;
}

export function whatsappLink(mobile: string, message: string): string {
  return `https://wa.me/${normalizeMobile(mobile)}?text=${encodeURIComponent(message)}`;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateAccessCode(): string {
  const bytes = randomBytes(8);
  const pick = (i: number) => CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `CBP-${[0, 1, 2, 3].map(pick).join("")}-${[4, 5, 6, 7].map(pick).join("")}`;
}

export function normalizeAccessCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function accessCodeMatches(stored: string | null, typed: string): boolean {
  if (!stored) return false;
  const a = normalizeAccessCode(stored);
  const b = normalizeAccessCode(typed);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface PriorApplication {
  requestId: string;
  status: RecruitmentCandidateStatus;
  closedAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// One live application per vacancy, and a waiting time after a failed test or a
// rejection (default 30 days, any vacancy). Declining an offer or losing out to
// someone else does not make anyone wait.
export function reapplyBlock(
  prior: PriorApplication[],
  requestId: string,
  now: Date,
  retakeDays: number
): { blocked: false } | { blocked: true; message: string } {
  if (prior.some((p) => p.requestId === requestId && isActiveCandidateStatus(p.status))) {
    return { blocked: true, message: "Anda sudah melamar lowongan ini dan lamaran Anda masih diproses." };
  }
  if (prior.some((p) => p.requestId === requestId && p.status === "HIRED")) {
    return { blocked: true, message: "Anda sudah diterima untuk lowongan ini." };
  }
  let until: Date | null = null;
  for (const p of prior) {
    if (!RETAKE_WAIT_STATUSES.includes(p.status) || !p.closedAt) continue;
    const end = new Date(p.closedAt.getTime() + retakeDays * DAY_MS);
    if (end.getTime() > now.getTime() && (!until || end.getTime() > until.getTime())) until = end;
  }
  if (until) {
    return {
      blocked: true,
      message: `Anda belum bisa melamar lagi. Lamaran berikutnya baru bisa dikirim setelah ${until.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" })}.`,
    };
  }
  return { blocked: false };
}

// ---------- tests ----------

export interface ScorableQuestion {
  id: string;
  correctIndex: number | null;
  reverseScored: boolean;
}

// Percent score of an automatically graded test. Unanswered scale statements get the
// lowest points, unanswered multiple-choice questions as wrong. Scale answers are
// 1-5: all 1s is 0%, all 5s is 100%.
export function scoreTest(
  form: RecruitmentTestForm,
  questions: ScorableQuestion[],
  answers: Map<string, number | null>
): number {
  const n = questions.length;
  if (n === 0 || form === "ESSAY") return 0;
  if (form === "MULTIPLE_CHOICE") {
    const correct = questions.filter((q) => q.correctIndex !== null && answers.get(q.id) === q.correctIndex).length;
    return Math.round((correct / n) * 1000) / 10;
  }
  let sum = 0;
  for (const q of questions) {
    const raw = answers.get(q.id);
    if (raw === undefined || raw === null) {
      sum += 1; // blank: the lowest points, however the statement is worded
      continue;
    }
    const clamped = Math.min(5, Math.max(1, raw));
    sum += q.reverseScored ? 6 - clamped : clamped;
  }
  return Math.round(((sum - n) / (4 * n)) * 1000) / 10;
}

export function isPassing(scorePercent: number, passScore: number): boolean {
  return scorePercent >= passScore;
}

export interface TestProgress {
  status: RecruitmentCandidateTestStatus;
  passed: boolean | null;
}

// What the applicant's overall status should be, from their tests alone.
export function deriveStatusFromTests(
  tests: TestProgress[]
): Extract<RecruitmentCandidateStatus, "TESTING" | "AWAITING_REVIEW" | "TEST_PASSED" | "TEST_FAILED"> {
  if (tests.some((t) => t.passed === false)) return "TEST_FAILED";
  if (tests.some((t) => t.status !== "SUBMITTED")) return "TESTING";
  if (tests.some((t) => t.passed === null)) return "AWAITING_REVIEW";
  return "TEST_PASSED";
}

export interface PlannableTest {
  id: string;
  isGate: boolean;
  sortOrder: number;
  active: boolean;
  /** Tests sharing a group are alternatives: an applicant gets just one of them. */
  variantGroup?: string | null;
}

// Every test an applicant could be given for a job (all alternatives included): the gate first, then
// the job's own tests in catalog order. Used to check that each one has questions.
export function possibleTestsForJob<T extends PlannableTest>(allTypes: T[], jobTestTypeIds: string[]): T[] {
  const wanted = allTypes.filter((t) => t.active && (t.isGate || jobTestTypeIds.includes(t.id)));
  return [...wanted].sort((a, b) => Number(b.isGate) - Number(a.isGate) || a.sortOrder - b.sortOrder);
}

// Which tests a vacancy uses: the ones picked on the vacancy itself, or else the job title's own.
export function testIdsForRequest(request: { testsCustomized: boolean; testTypeIds: string[] }, jobDefault: string[]): string[] {
  return request.testsCustomized ? request.testTypeIds : jobDefault;
}

// One column / tick per test, with the alternative sets of a group (Ketelitian Set A + B) sharing one.
export function groupTestColumns(types: { id: string; name: string; variantGroup?: string | null }[]): { key: string; label: string; ids: string[] }[] {
  const columns: { key: string; label: string; ids: string[] }[] = [];
  for (const t of types) {
    const group = t.variantGroup?.trim();
    const key = group || t.id;
    const col = columns.find((c) => c.key === key);
    if (col) col.ids.push(t.id);
    else columns.push({ key, label: group || t.name, ids: [t.id] });
  }
  return columns;
}

const groupOf = (t: PlannableTest) => t.variantGroup?.trim() || null;

// From each group of alternatives keep the one handed out least so far (a coin toss between equals),
// so Set A and Set B alternate and neither is seen more than the other. Tests outside a group stay.
export function pickVariants<T extends PlannableTest>(possible: T[], usage: Map<string, number> = new Map(), random: () => number = Math.random): T[] {
  const chosen = new Map<string, T>();
  for (const t of possible) {
    const g = groupOf(t);
    if (g && !chosen.has(g)) {
      const members = possible.filter((x) => groupOf(x) === g);
      const least = Math.min(...members.map((m) => usage.get(m.id) ?? 0));
      const ties = members.filter((m) => (usage.get(m.id) ?? 0) === least);
      chosen.set(g, ties[Math.min(ties.length - 1, Math.floor(random() * ties.length))]);
    }
  }
  return possible.filter((t) => {
    const g = groupOf(t);
    return g ? chosen.get(g) === t : true;
  });
}

// The tests an applicant takes.
export function planTestsForJob<T extends PlannableTest>(
  allTypes: T[],
  jobTestTypeIds: string[],
  opts: { usage?: Map<string, number>; random?: () => number } = {}
): T[] {
  return pickVariants(possibleTestsForJob(allTypes, jobTestTypeIds), opts.usage, opts.random);
}

// What an applicant sees as the test's name: the group name when it is one of several alternatives.
export function testDisplayName(t: { name: string; variantGroup?: string | null }): string {
  return t.variantGroup?.trim() || t.name;
}

// "Ketelitian (salah satu dari 2 set)" style steps for the page that tells applicants what to expect.
export function describeTestSteps<T extends PlannableTest & { name: string; timeLimitMinutes: number }>(possible: T[]): { label: string; timeLimitMinutes: number }[] {
  const steps: { label: string; timeLimitMinutes: number; group: string | null }[] = [];
  for (const t of possible) {
    const g = groupOf(t);
    const existing = g ? steps.find((s) => s.group === g) : undefined;
    if (existing) existing.timeLimitMinutes = Math.max(existing.timeLimitMinutes, t.timeLimitMinutes);
    else steps.push({ label: testDisplayName(t), timeLimitMinutes: t.timeLimitMinutes, group: g });
  }
  return steps.map(({ label, timeLimitMinutes }) => ({ label, timeLimitMinutes }));
}

// ---------- shuffled answer options ----------

// Options that only make sense at the end of a list ("Semua benar", "Tidak bisa ditentukan" ...).
const ANCHORED_OPTION = /^(semua(\s+jawaban)?\s+(di\s*atas\s+)?benar|tidak\s+ada(\s+(yang|jawaban))?\b|tidak\s+(dapat|bisa)\s+(disimpulkan|ditentukan|dipastikan)|salah\s+semua|jawaban\s+(a|b|c|d|e)\s+dan)/i;

export function isAnchoredOption(text: string): boolean {
  return ANCHORED_OPTION.test(text.trim());
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The order an applicant sees the options in: a list of the ORIGINAL option numbers. The same seed
// (the applicant's test and the question) always gives the same order, so a refresh changes nothing.
// "Semua benar"-style options keep their place at the end.
export function optionDisplayOrder(options: string[], seed: string, shuffle: boolean): number[] {
  const all = options.map((_, i) => i);
  if (!shuffle) return all;
  const movable = all.filter((i) => !isAnchoredOption(options[i]));
  const anchored = all.filter((i) => isAnchoredOption(options[i]));
  const random = seededRandom(seed);
  for (let i = movable.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [movable[i], movable[j]] = [movable[j], movable[i]];
  }
  return [...movable, ...anchored];
}

// "Istimewa" for HR: the test has a threshold and the score reached it.
export function isExcellent(scorePercent: number | null, excellentScore: number | null | undefined): boolean {
  return scorePercent !== null && excellentScore != null && scorePercent >= excellentScore;
}

// A test may start only when every earlier one is submitted and none failed.
export function canStartTest(sortedTests: TestProgress[], index: number): boolean {
  if (sortedTests[index]?.status === "SUBMITTED") return false;
  return sortedTests.slice(0, index).every((t) => t.status === "SUBMITTED" && t.passed !== false);
}

// Seconds left, never negative.
export function secondsLeft(deadlineAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / 1000));
}

export function isExpired(deadlineAt: Date | null, now: Date, graceSeconds = 5): boolean {
  return !!deadlineAt && now.getTime() > deadlineAt.getTime() + graceSeconds * 1000;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------- messages ----------

export const TEMPLATE_PLACEHOLDERS = ["{nama}", "{posisi}", "{tanggal}", "{jam}", "{lokasi}"];

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(nama|posisi|tanggal|jam|lokasi)\}/gi, (_m, key: string) => vars[key.toLowerCase()] ?? "");
}

// ---------- what HR Admin should do next ----------

export interface CandidateProgress {
  status: RecruitmentCandidateStatus;
  hasReviewer: boolean; // for an essay waiting for review
  hasInterview: boolean;
  interviewersTotal: number;
  interviewersSubmitted: number;
  hasOffer: boolean;
  offerSent: boolean;
  offerAccepted: boolean;
  hasMovement: boolean;
  movementOpen: boolean;
}

export function candidateNextStep(p: CandidateProgress): { label: string; needsAction: boolean } {
  switch (p.status) {
    case "TESTING":
      return { label: "Menunggu tes selesai", needsAction: false };
    case "AWAITING_REVIEW":
      return p.hasReviewer
        ? { label: "Menunggu hasil review esai", needsAction: false }
        : { label: "Pilih reviewer esai", needsAction: true };
    case "TEST_PASSED":
      return { label: "Undang interview", needsAction: true };
    case "INTERVIEWING":
      if (!p.hasInterview) return { label: "Jadwalkan interview", needsAction: true };
      if (p.interviewersTotal > 0 && p.interviewersSubmitted >= p.interviewersTotal) {
        return { label: "Tetapkan hasil akhir", needsAction: true };
      }
      return { label: `Menunggu penilaian (${p.interviewersSubmitted} dari ${p.interviewersTotal})`, needsAction: false };
    case "OFFERING":
      if (!p.hasOffer) return { label: "Unggah offering letter", needsAction: true };
      if (p.offerAccepted) return { label: "Buat karyawan dari kandidat", needsAction: true };
      if (!p.offerSent) return { label: "Kirim offering ke kandidat", needsAction: true };
      return { label: "Menunggu jawaban kandidat", needsAction: false };
    case "MOVEMENT":
      if (!p.hasMovement) return { label: "Buat Perubahan Posisi", needsAction: true };
      if (p.movementOpen) return { label: "Menunggu persetujuan Perubahan Posisi", needsAction: false };
      return { label: "Perubahan Posisi tidak jalan, putuskan lagi", needsAction: true };
    default:
      return { label: "Selesai", needsAction: false };
  }
}

// ---------- interview results ----------

export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function countDecisions(
  recs: (RecruitmentInterviewDecision | null)[]
): Record<RecruitmentInterviewDecision, number> {
  const out: Record<RecruitmentInterviewDecision, number> = { ACCEPTED: 0, CONSIDERED: 0, REJECTED: 0 };
  for (const r of recs) if (r) out[r]++;
  return out;
}

// ---------- files ----------

export const CV_MAX_BYTES = 4 * 1024 * 1024;
const CV_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
};

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function validateCvFile(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return "Berkas CV kosong.";
  if (file.size > CV_MAX_BYTES) return "Berkas CV maksimal 4 MB.";
  const ext = fileExtension(file.name);
  const allowed = CV_TYPES[ext];
  if (!allowed) return "CV harus berupa PDF, Word (doc/docx), atau foto JPG/PNG.";
  if (file.type && !allowed.includes(file.type)) return "Jenis berkas CV tidak sesuai dengan ekstensinya.";
  return null;
}

export function validateOfferFile(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return "Berkas kosong.";
  if (file.size > CV_MAX_BYTES) return "Berkas maksimal 4 MB.";
  if (fileExtension(file.name) !== ".pdf" || (file.type && file.type !== "application/pdf")) {
    return "Offering letter harus berupa PDF.";
  }
  return null;
}

// Signature drawn on screen arrives as a PNG data URL; keep only plausible ones.
export const SIGNATURE_MAX_CHARS = 200_000;

export function isValidSignatureDataUrl(value: string): boolean {
  return value.startsWith("data:image/png;base64,") && value.length > 400 && value.length <= SIGNATURE_MAX_CHARS;
}

// ---------- essays ----------

export const ESSAY_MIN_CHARS = 100;
export const ESSAY_MAX_CHARS = 8000;

// ---------- question bank ----------

export interface ParsedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number | null;
}

export const MAX_OPTIONS = 6;

// Reads pasted lines into questions. Scale and essay: one question per line. Multiple
// choice: "Soal | opsi A; opsi B; opsi C | 2" where the last part is the number of the
// correct option (1 = the first).
export function parseBulkQuestions(
  form: RecruitmentTestForm,
  text: string,
  maxQuestions = 200
): { questions: ParsedQuestion[]; errors: string[] } {
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > maxQuestions) return { questions, errors: [`Maksimal ${maxQuestions} soal sekali tempel.`] };
  lines.forEach((line, i) => {
    const n = i + 1;
    if (form !== "MULTIPLE_CHOICE") {
      if (line.length > 1000) errors.push(`Baris ${n}: soal terlalu panjang (maksimal 1000 karakter).`);
      else questions.push({ prompt: line, options: [], correctIndex: null });
      return;
    }
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length !== 3) {
      errors.push(`Baris ${n}: gunakan format  Soal | opsi A; opsi B; opsi C | nomor jawaban benar.`);
      return;
    }
    const options = parts[1].split(";").map((o) => o.trim()).filter(Boolean);
    const correct = Number(parts[2]);
    if (!parts[0]) errors.push(`Baris ${n}: soal kosong.`);
    else if (options.length < 2 || options.length > MAX_OPTIONS) errors.push(`Baris ${n}: isi 2 sampai ${MAX_OPTIONS} opsi, dipisah titik koma.`);
    else if (!Number.isInteger(correct) || correct < 1 || correct > options.length) errors.push(`Baris ${n}: nomor jawaban benar harus 1 sampai ${options.length}.`);
    else questions.push({ prompt: parts[0], options, correctIndex: correct - 1 });
  });
  return { questions, errors };
}

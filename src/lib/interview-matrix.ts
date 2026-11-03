// The interview score matrix: scores 2, 4, 6, 8 or 10, the HR round by Admin Rekrutmen and what a rejection by HR does.
// Pure rules, no Prisma, so they are unit tested.
import type { InterviewCancelKind, RecruitmentCandidateStatus, RecruitmentInterviewDecision } from "@/generated/prisma/enums";

export const MATRIX_MAX = 10;
export const SCORE_STEPS = [2, 4, 6, 8, 10] as const;
export const SCORE_LABEL: Record<number, string> = { 2: "Sangat kurang", 4: "Kurang", 6: "Cukup", 8: "Baik", 10: "Sangat baik" };
// Scores given before the matrix changed were 1-5.
export const LEGACY_MAX = 5;

export interface MatrixAspect {
  id: string;
  label: string;
  /** May be left empty (Tes Lapangan); an empty one does not count in the average. */
  optional: boolean;
}

// What the form sent (aspect id -> number, anything else is rejected) against the aspects in use. Returns the scores to
// store, or the first problem in plain words.
export function checkMatrixScores(aspects: MatrixAspect[], sent: Record<string, number | undefined>): { ok: true; scores: { aspectId: string; label: string; score: number }[] } | { ok: false; error: string } {
  const scores: { aspectId: string; label: string; score: number }[] = [];
  for (const a of aspects) {
    const value = sent[a.id];
    if (value === undefined || Number.isNaN(value)) {
      if (a.optional) continue;
      return { ok: false, error: `Beri nilai untuk "${a.label}".` };
    }
    if (!(SCORE_STEPS as readonly number[]).includes(value)) return { ok: false, error: `Nilai "${a.label}" harus 2, 4, 6, 8 atau 10.` };
    scores.push({ aspectId: a.id, label: a.label, score: value });
  }
  return { ok: true, scores };
}

// One decimal, e.g. 7,3. Null when nothing was scored.
export function matrixAverage(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

// A score next to the scale it was given on: matrix scores show as is, old ones as "4 dari 5".
export function scoreText(score: number | null | undefined, maxScore: number): string {
  if (score === null || score === undefined) return "—";
  return maxScore === MATRIX_MAX ? String(score) : `${score} dari ${maxScore}`;
}

// ---------- the HR round ----------

export interface HrState {
  candidateStatus: RecruitmentCandidateStatus;
  interviewDecision: RecruitmentInterviewDecision | null;
  hasHrInterview: boolean;
  hrCancelled: boolean;
  hrSubmitted: boolean;
}

// The HR interview can be scheduled (or its time changed) while the applicant is in the interview stage and the HR form is not sent.
export function canScheduleHr(s: Pick<HrState, "candidateStatus" | "interviewDecision" | "hrSubmitted" | "hrCancelled">): boolean {
  const stage = s.candidateStatus === "TEST_PASSED" || (s.candidateStatus === "INTERVIEWING" && !s.interviewDecision);
  return stage && !s.hrSubmitted && !s.hrCancelled;
}

export function canSubmitHr(s: HrState): boolean {
  return s.hasHrInterview && !s.hrCancelled && !s.hrSubmitted && s.candidateStatus === "INTERVIEWING" && !s.interviewDecision;
}

export function hrFormProblem(input: { recommendation: string; note: string }): string | null {
  if (!["ACCEPTED", "CONSIDERED", "REJECTED"].includes(input.recommendation)) return "Pilih rekomendasi HR.";
  if (input.recommendation === "REJECTED" && input.note.trim().length < 3) return "Catatan wajib diisi kalau pelamar ditolak.";
  return null;
}

// What is written on the applicant when HR turns them down.
export function hrRejectCloseReason(note: string): string {
  return `Ditolak pada interview HR: ${note.trim()}`;
}

export const HR_REJECT_KIND: InterviewCancelKind = "HR_REJECTED";

// The e-mail to the interviewers of the user interview that was cancelled because HR turned the applicant down.
export function hrRejectEmail(args: { candidateName: string; positionTitle: string; tanggal: string; jam: string }): { subject: string; text: string } {
  return {
    subject: "Interview dibatalkan (SAPA)",
    text: `Interview ${args.candidateName} untuk ${args.positionTitle} pada ${args.tanggal}, ${args.jam} dibatalkan karena pelamar tidak lolos interview HR. Anda tidak perlu mengisi penilaian.`,
  };
}

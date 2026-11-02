// "Pelamar tidak datang interview": the rules, wording and e-mail text, without Prisma so they are unit tested.
// Admin Rekrutmen records it after the applicant tells them (WhatsApp or phone), or when the applicant did not show up.
import { DAY_MS } from "@/lib/company-time";
import type { InterviewCancelKind, RecruitmentCandidateStatus, RecruitmentInterviewDecision } from "@/generated/prisma/enums";

export const CANCEL_KIND_LABEL: Record<InterviewCancelKind, string> = {
  WITHDREW: "Mengundurkan diri",
  NO_SHOW: "Tidak datang, tanpa kabar",
};
export const CANCEL_KIND_HINT: Record<InterviewCancelKind, string> = {
  WITHDREW: "Tidak melanjutkan proses lamaran.",
  NO_SHOW: "Jam interview lewat dan pelamar tidak muncul.",
};
export const CANCEL_QUICK_REASONS = ["Sudah dapat pekerjaan lain", "Alasan pribadi / keluarga", "Lokasi kerja terlalu jauh", "Gaji tidak sesuai", "Lainnya"];
// A cancelled interview stays in the interviewer's task list this long, then disappears from it.
export const CANCEL_NOTICE_DAYS = 7;

export interface CancelState {
  candidateStatus: RecruitmentCandidateStatus;
  interviewDecision: RecruitmentInterviewDecision | null;
  hasInterview: boolean;
  alreadyCancelled: boolean;
  /** Interviewers who already sent their penilaian. */
  submittedInterviewers: number;
}

// Can the button be shown at all (the interview is scheduled and nothing has been assessed yet)?
export function canCancelInterview(s: CancelState): boolean {
  return s.hasInterview && !s.alreadyCancelled && s.candidateStatus === "INTERVIEWING" && !s.interviewDecision && s.submittedInterviewers === 0;
}

export function cancelProblem(s: CancelState, input: { kind: string; note: string }, scheduledAt: Date | null, now: Date): string | null {
  if (!s.hasInterview) return "Pelamar ini belum punya jadwal interview.";
  if (s.alreadyCancelled) return "Interview ini sudah dibatalkan.";
  if (s.candidateStatus !== "INTERVIEWING" || s.interviewDecision) return "Pelamar ini sudah tidak dalam tahap interview.";
  if (s.submittedInterviewers > 0) return "Pewawancara sudah mengisi penilaian. Gunakan Akhiri proses pelamar ini.";
  if (input.kind !== "WITHDREW" && input.kind !== "NO_SHOW") return "Pilih apa yang pelamar sampaikan.";
  if (input.kind === "NO_SHOW" && scheduledAt && scheduledAt.getTime() > now.getTime()) return "Jam interview belum lewat. Pilih Mengundurkan diri kalau pelamar sudah mengabari.";
  if (input.note.trim().length < 3) return "Catatan wajib diisi.";
  return null;
}

// What is written on the applicant as the reason the process ended.
export function closeReasonText(kind: InterviewCancelKind, reason: string | null, note: string): string {
  return [`${CANCEL_KIND_LABEL[kind]} sebelum interview`, reason?.trim() || null, note.trim()].filter(Boolean).join(": ");
}

export function cancelEmail(args: { candidateName: string; positionTitle: string; tanggal: string; jam: string; kind: InterviewCancelKind }): { subject: string; text: string } {
  const why = args.kind === "WITHDREW" ? "pelamar mengundurkan diri" : "pelamar tidak datang";
  return {
    subject: "Interview dibatalkan (SAPA)",
    text: `Interview ${args.candidateName} untuk ${args.positionTitle} pada ${args.tanggal}, ${args.jam} dibatalkan karena ${why}. Anda tidak perlu mengisi penilaian.`,
  };
}

// The interviewer still sees the cancelled row for a week.
export function cancelNoticeVisible(cancelledAt: Date | null, now: Date): boolean {
  return !!cancelledAt && now.getTime() - cancelledAt.getTime() <= CANCEL_NOTICE_DAYS * DAY_MS;
}

export function cancelledLabel(kind: InterviewCancelKind | null): string {
  return kind === "NO_SHOW" ? "Pelamar tidak datang" : "Pelamar mengundurkan diri";
}

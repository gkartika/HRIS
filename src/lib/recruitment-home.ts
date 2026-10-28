// Pure rules for the Admin Rekrutmen Beranda: what the recruiter has to do now (grouped by kind of work),
// what is waiting for someone else, the interviews of the coming week, the progress of every vacancy and the
// setup warnings. No Prisma/Next imports, so it is unit testable. Severity and the waiting wording are shared
// with the Admin GA / Admin SDM Beranda (ga-home.ts).
import { DAY_MS, WIB_OFFSET_MS } from "@/lib/company-time";
import { daysSince, daysUntil, SEVERITY_RANK, sortTodo, waitingLabel, waitingSeverity, type Severity } from "@/lib/ga-home";
import { ASSESSMENT_NOT_ACTIVE_PROBLEM, candidateNextStep, type CandidateProgress } from "@/lib/recruitment-candidates";
import type { RecruitmentCandidateStatus } from "@/generated/prisma/enums";

export type RecKind = "vc" | "es" | "iv" | "of" | "mv";

// The groups of "Kerjakan sekarang", in the order they are shown.
export const REC_GROUPS: { key: RecKind; label: string; hint: string }[] = [
  { key: "vc", label: "Siapkan lowongan", hint: "Permintaan sudah disetujui, tinggal dibuka" },
  { key: "es", label: "Seleksi pelamar", hint: "Tes dan penilaian esai" },
  { key: "iv", label: "Interview", hint: "Jadwal dan hasil" },
  { key: "of", label: "Offering & penerimaan", hint: "Dari lolos interview sampai jadi karyawan" },
  { key: "mv", label: "Perpindahan internal", hint: "Pelamar internal yang pindah posisi" },
];

export const REC_FILTERS: { key: RecKind | "all"; label: string }[] = [{ key: "all", label: "Semua" }, ...REC_GROUPS.map((g) => ({ key: g.key, label: g.label }))];

export interface HomeCandidate {
  id: string;
  requestId: string;
  requestNumber: string;
  jobLabel: string;
  fullName: string;
  status: RecruitmentCandidateStatus;
  statusChangedAt: Date;
  progress: CandidateProgress;
  interviewAt: Date | null;
  interviewMode: "ONLINE" | "OFFLINE" | null;
  offerSentAt: Date | null;
  movementStatus: string | null;
  /** Passed a test with an "Istimewa" score. */
  excellent: boolean;
}

// An approved request that is being recruited (or waiting to be opened).
export interface HomeRequest {
  id: string;
  requestNumber: string;
  jobLabel: string;
  department: string;
  headcount: number;
  filled: number;
  approvedAt: Date | null;
  heldAt: Date | null;
  /** Open for applicants (external, internal or both). */
  opened: boolean;
  /** The vacancy detail applicants read has been written. */
  hasDetail: boolean;
  /** What stops an open vacancy from taking applicants. */
  problems: string[];
  /** Every applicant so far, including those who dropped out. */
  totalApplicants: number;
}

export interface RecRow {
  kind: RecKind;
  /** What has to be done ("Jadwalkan interview"). */
  type: string;
  /** Who or what it is about. */
  title: string;
  who: string;
  statusLabel: string;
  severity: Severity;
  /** Sort weight inside a severity: larger = needs attention sooner. */
  urgency: number;
  timeLabel: string;
  actionLabel: string;
  href: string;
  requestId: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "14 Okt" / "Rabu, 21 Okt 09.00" in WIB.
function wibParts(d: Date) {
  const w = new Date(d.getTime() + WIB_OFFSET_MS);
  return w;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export function shortDate(d: Date): string {
  const w = wibParts(d);
  return `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]}`;
}
export function timeOfDay(d: Date): string {
  const w = wibParts(d);
  return `${String(w.getUTCHours()).padStart(2, "0")}.${String(w.getUTCMinutes()).padStart(2, "0")}`;
}
export function interviewWhen(d: Date): string {
  const w = wibParts(d);
  return `${WEEKDAYS[w.getUTCDay()]}, ${shortDate(d)} ${timeOfDay(d)}`;
}

const candidateHref = (c: { requestId: string; id: string }) => `/recruitment/${c.requestId}/candidates/${c.id}`;
const who = (c: HomeCandidate) => `${c.requestNumber} · ${c.jobLabel}`;

function waitingRow(c: { statusChangedAt: Date }, now: Date) {
  const age = daysSince(c.statusChangedAt, now);
  return {
    age,
    severity: waitingSeverity(age),
    urgency: age,
    statusLabel: capitalize(waitingLabel(age)),
    timeLabel: age === 0 ? "" : `sejak ${shortDate(c.statusChangedAt)}`,
  };
}

const decided = (p: CandidateProgress) => p.interviewersTotal > 0 && p.interviewersSubmitted >= p.interviewersTotal;

// Approved requests the recruiter still has to open: write the vacancy detail, then open it.
function buildVacancyRows(requests: HomeRequest[], now: Date): RecRow[] {
  const rows: RecRow[] = [];
  for (const r of requests) {
    if (r.opened || r.heldAt || r.filled >= r.headcount) continue;
    const age = r.approvedAt ? daysSince(r.approvedAt, now) : 0;
    rows.push({
      kind: "vc",
      type: r.hasDetail ? "Buka lowongan" : "Tulis detail lowongan",
      title: r.jobLabel,
      who: `${r.requestNumber} · ${r.department} · ${r.headcount - r.filled} posisi`,
      severity: waitingSeverity(age),
      urgency: age,
      statusLabel: capitalize(waitingLabel(age)),
      timeLabel: r.approvedAt && age > 0 ? `disetujui ${shortDate(r.approvedAt)}` : "",
      actionLabel: r.hasDetail ? "Buka" : "Tulis detail",
      href: `/recruitment/${r.id}`,
      requestId: r.id,
    });
  }
  return rows;
}

// What is waiting for the recruiter, oldest first inside each colour. Applicants in the same
// step of the same request are shown as one row ("4 pelamar lolos tes").
export function buildRecruitmentRows(candidates: HomeCandidate[], now: Date, requests: HomeRequest[] = []): RecRow[] {
  const rows: RecRow[] = buildVacancyRows(requests, now);
  const groups = new Map<string, { kind: "review" | "invite"; items: HomeCandidate[] }>();

  for (const c of candidates) {
    const p = c.progress;
    if (c.status === "AWAITING_REVIEW" && !p.hasReviewer) {
      const g = groups.get(`review:${c.requestId}`) ?? { kind: "review" as const, items: [] };
      g.items.push(c);
      groups.set(`review:${c.requestId}`, g);
      continue;
    }
    if (c.status === "TEST_PASSED") {
      const g = groups.get(`invite:${c.requestId}`) ?? { kind: "invite" as const, items: [] };
      g.items.push(c);
      groups.set(`invite:${c.requestId}`, g);
      continue;
    }

    const w = waitingRow(c, now);
    const base = { requestId: c.requestId, href: candidateHref(c), title: c.fullName };
    if (c.status === "INTERVIEWING") {
      if (!p.hasInterview) {
        rows.push({ ...base, kind: "iv", type: "Jadwalkan interview", who: who(c), ...w, actionLabel: "Jadwalkan" });
      } else if (decided(p)) {
        rows.push({
          ...base,
          kind: "iv",
          type: "Putuskan hasil interview",
          who: `${who(c)} · ${p.interviewersSubmitted} dari ${p.interviewersTotal} pewawancara sudah mengisi`,
          ...w,
          actionLabel: "Putuskan",
        });
      }
    } else if (c.status === "OFFERING") {
      const step = candidateNextStep(p);
      if (!step.needsAction) continue;
      const row = !p.hasOffer
        ? { type: "Unggah offering letter", a: "Unggah surat", extra: "" }
        : p.offerAccepted
          ? { type: "Buat karyawan", a: "Buat karyawan", extra: " · jawaban offering diterima" }
          : { type: "Kirim offering letter", a: "Kirim surat", extra: "" };
      rows.push({ ...base, kind: "of", type: row.type, who: who(c) + row.extra, ...w, actionLabel: row.a });
    } else if (c.status === "MOVEMENT") {
      if (!p.hasMovement) {
        rows.push({ ...base, kind: "mv", type: "Ajukan Perubahan Posisi", title: `${c.fullName} (internal)`, who: who(c), ...w, actionLabel: "Ajukan" });
      } else if (c.movementStatus === "APPROVED") {
        rows.push({ ...base, kind: "mv", type: "Jalankan perpindahan", title: `${c.fullName} (internal)`, who: `${who(c)} · sudah disetujui`, ...w, actionLabel: "Jalankan" });
      } else if (!p.movementOpen) {
        rows.push({ ...base, kind: "mv", type: "Putuskan lagi", title: `${c.fullName} (internal)`, who: `${who(c)} · Perubahan Posisi tidak jalan`, ...w, actionLabel: "Buka" });
      }
    }
  }

  for (const g of groups.values()) {
    const oldest = g.items.reduce((a, b) => (a.statusChangedAt < b.statusChangedAt ? a : b));
    const w = waitingRow(oldest, now);
    const first = g.items[0];
    const one = g.items.length === 1;
    const special = g.items.filter((c) => c.excellent).length;
    if (g.kind === "review") {
      rows.push({
        kind: "es",
        type: "Pilih penilai esai",
        title: one ? first.fullName : `${g.items.length} pelamar`,
        who: `${who(first)} · esai selesai, belum ada penilai`,
        ...w,
        actionLabel: "Pilih penilai",
        href: one ? candidateHref(first) : `/recruitment/${first.requestId}?stage=review`,
        requestId: first.requestId,
      });
    } else {
      rows.push({
        kind: "iv",
        type: "Undang interview",
        title: one ? first.fullName : `${g.items.length} pelamar lolos tes`,
        who: `${who(first)} · lolos tes${special > 0 ? ` · ${special} berpredikat istimewa` : ""}`,
        ...w,
        actionLabel: "Atur interview",
        href: one ? candidateHref(first) : `/recruitment/${first.requestId}?stage=lolos`,
        requestId: first.requestId,
      });
    }
  }

  return sortTodo(rows);
}

export function recRowCounts(rows: RecRow[]): Record<RecKind | "all", number> {
  const out: Record<RecKind | "all", number> = { all: rows.length, vc: 0, es: 0, iv: 0, of: 0, mv: 0 };
  for (const r of rows) out[r.kind] += 1;
  return out;
}

// ---------- waiting for someone else ----------

export interface WaitingItem {
  title: string;
  detail: string;
  severity: Severity;
  age: number;
  href: string;
  requestId: string;
}

// Not the recruiter's task now (an offering waiting for an answer, an interviewer who has not filled in the form...),
// but worth watching: it turns amber after 3 days and red after 7.
export function buildWaitingItems(candidates: HomeCandidate[], now: Date): WaitingItem[] {
  const items: WaitingItem[] = [];
  const testing = new Map<string, HomeCandidate[]>();
  const add = (c: HomeCandidate, title: string, detail: string, since: Date) => {
    const age = daysSince(since, now);
    items.push({ title, detail, severity: waitingSeverity(age), age, href: candidateHref(c), requestId: c.requestId });
  };

  for (const c of candidates) {
    const p = c.progress;
    if (c.status === "TESTING") {
      testing.set(c.requestId, [...(testing.get(c.requestId) ?? []), c]);
    } else if (c.status === "AWAITING_REVIEW" && p.hasReviewer) {
      add(c, "Penilai esai belum selesai menilai", `${c.fullName} · ${who(c)}`, c.statusChangedAt);
    } else if (c.status === "INTERVIEWING" && p.hasInterview && c.interviewAt && c.interviewAt.getTime() <= now.getTime() && !decided(p)) {
      const filled = p.interviewersTotal === 0 ? "belum ada pewawancara" : `${p.interviewersSubmitted} dari ${p.interviewersTotal} pewawancara sudah mengisi`;
      add(c, "Pewawancara belum mengisi penilaian", `${c.fullName} · interview ${shortDate(c.interviewAt)} · ${filled}`, c.interviewAt);
    } else if (c.status === "OFFERING" && p.offerSent && !p.offerAccepted) {
      add(c, "Offering menunggu jawaban", `${c.fullName} · ${who(c)}${c.offerSentAt ? ` · dikirim ${shortDate(c.offerSentAt)}` : ""}`, c.offerSentAt ?? c.statusChangedAt);
    } else if (c.status === "MOVEMENT" && p.hasMovement && p.movementOpen && c.movementStatus !== "APPROVED") {
      add(c, "Perubahan Posisi menunggu persetujuan", `${c.fullName} (internal) · ${who(c)}`, c.statusChangedAt);
    }
  }

  for (const list of testing.values()) {
    const oldest = list.reduce((a, b) => (a.statusChangedAt < b.statusChangedAt ? a : b));
    add(oldest, "Pelamar belum selesai mengerjakan tes", list.length === 1 ? `${oldest.fullName} · ${who(oldest)}` : `${list.length} pelamar · ${who(oldest)}`, oldest.statusChangedAt);
  }

  return sortTodo(items.map((i) => ({ ...i, urgency: i.age })));
}

// ---------- interviews of the coming week ----------

export interface UpcomingInterview {
  id: string;
  at: Date;
  dayLabel: string;
  time: string;
  fullName: string;
  jobLabel: string;
  modeLabel: string | null;
  interviewersLabel: string;
  /** No interviewer chosen yet. */
  needsInterviewer: boolean;
  href: string;
}

export function buildUpcomingInterviews(candidates: HomeCandidate[], now: Date): UpcomingInterview[] {
  return candidates
    .filter((c) => c.status === "INTERVIEWING" && c.interviewAt && c.interviewAt.getTime() > now.getTime() && c.interviewAt.getTime() - now.getTime() <= 7 * DAY_MS)
    .map((c) => {
      const at = c.interviewAt as Date;
      const days = daysUntil(at, now);
      const total = c.progress.interviewersTotal;
      const weekday = `${WEEKDAYS[wibParts(at).getUTCDay()]}, ${shortDate(at)}`;
      return {
        id: c.id,
        at,
        dayLabel: days === 0 ? `Hari ini · ${weekday}` : days === 1 ? `Besok · ${weekday}` : weekday,
        time: timeOfDay(at),
        fullName: c.fullName,
        jobLabel: c.jobLabel,
        modeLabel: c.interviewMode === "ONLINE" ? "Online" : c.interviewMode === "OFFLINE" ? "Offline" : null,
        interviewersLabel: total === 0 ? "Belum ada pewawancara" : `${total} pewawancara`,
        needsInterviewer: total === 0,
        href: candidateHref({ requestId: c.requestId, id: c.id }),
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

// ---------- progress of every vacancy ----------

export interface VacancyProgress {
  id: string;
  requestNumber: string;
  jobLabel: string;
  department: string;
  headcount: number;
  filled: number;
  state: "held" | "unopened" | "open";
  /** Days since the request was approved. */
  approvedDays: number | null;
  totalApplicants: number;
  /** Applicants in each step right now, then the seats filled. */
  stages: { label: string; count: number }[];
  next: { text: string; severity: Severity };
}

const STAGES: { label: string; statuses: RecruitmentCandidateStatus[] }[] = [
  { label: "Tes", statuses: ["TESTING"] },
  { label: "Review", statuses: ["AWAITING_REVIEW"] },
  { label: "Lolos tes", statuses: ["TEST_PASSED"] },
  { label: "Interview", statuses: ["INTERVIEWING"] },
  { label: "Offering", statuses: ["OFFERING", "MOVEMENT"] },
];

export function buildVacancyProgress(input: { requests: HomeRequest[]; candidates: HomeCandidate[]; rows: RecRow[]; waiting: WaitingItem[]; now: Date }): VacancyProgress[] {
  const { requests, candidates, rows, waiting, now } = input;
  const list = requests.map((r): VacancyProgress => {
    const mine = candidates.filter((c) => c.requestId === r.id);
    const myRows = rows.filter((x) => x.requestId === r.id);
    const myWaiting = waiting.filter((x) => x.requestId === r.id);
    const state = r.heldAt ? "held" : r.opened ? "open" : "unopened";

    let next: VacancyProgress["next"];
    if (state === "held") next = { text: "Ditahan, tidak bisa dibuka sampai dilanjutkan", severity: "slate" };
    else if (myRows.length > 0) {
      const first = myRows[0];
      next = {
        text: myRows.length === 1 ? `${first.type}: ${first.title}` : `${myRows.length} hal perlu Anda kerjakan. Mulai dari: ${first.type.toLowerCase()}, ${first.title}`,
        severity: first.severity,
      };
    } else if (state === "open" && r.problems.length > 0) next = { text: `Belum siap menerima pelamar: ${r.problems[0]}`, severity: "amber" };
    else if (myWaiting.length > 0) next = { text: `Menunggu pihak lain: ${myWaiting[0].title.toLowerCase()}`, severity: "slate" };
    else if (mine.length === 0) next = { text: "Belum ada pelamar yang sedang diproses.", severity: "slate" };
    else next = { text: "Tidak ada yang perlu Anda kerjakan di lowongan ini.", severity: "slate" };

    return {
      id: r.id,
      requestNumber: r.requestNumber,
      jobLabel: r.jobLabel,
      department: r.department,
      headcount: r.headcount,
      filled: r.filled,
      state,
      approvedDays: r.approvedAt ? daysSince(r.approvedAt, now) : null,
      totalApplicants: r.totalApplicants,
      stages: [...STAGES.map((s) => ({ label: s.label, count: mine.filter((c) => s.statuses.includes(c.status)).length })), { label: "Terisi", count: r.filled }],
      next,
    };
  });
  const held = (v: VacancyProgress) => Number(v.state === "held");
  return list.sort((a, b) => held(a) - held(b) || SEVERITY_RANK[a.next.severity] - SEVERITY_RANK[b.next.severity] || (b.approvedDays ?? 0) - (a.approvedDays ?? 0));
}

// ---------- the four numbers at the top ----------

export interface HomeStats {
  todo: number;
  /** To-do rows that have waited 3 days or more. */
  overdue: number;
  interviews: number;
  interviewsToday: number;
  interviewsTomorrow: number;
  waiting: number;
  filled: number;
  headcount: number;
}

export function buildHomeStats(input: { rows: RecRow[]; upcoming: UpcomingInterview[]; waiting: WaitingItem[]; vacancies: VacancyProgress[]; now: Date }): HomeStats {
  const { rows, upcoming, waiting, vacancies, now } = input;
  const open = vacancies.filter((v) => v.state !== "held");
  return {
    todo: rows.length,
    overdue: rows.filter((r) => r.severity !== "slate").length,
    interviews: upcoming.length,
    interviewsToday: upcoming.filter((i) => daysUntil(i.at, now) === 0).length,
    interviewsTomorrow: upcoming.filter((i) => daysUntil(i.at, now) === 1).length,
    waiting: waiting.length,
    filled: open.reduce((sum, v) => sum + Math.min(v.filled, v.headcount), 0),
    headcount: open.reduce((sum, v) => sum + v.headcount, 0),
  };
}

// ---------- setup warnings ----------

export interface SetupWarning {
  text: string;
  href: string;
  actionLabel: string;
}

const MAX_WARNINGS = 4;

export function buildSetupWarnings(input: {
  types: { id: string; name: string; isGate: boolean; active: boolean; activeQuestions: number }[];
  /** For each open vacancy: the tests it uses (by id). */
  openVacancies: { id: string; requestNumber: string; testTypeIds: string[]; problems: string[] }[];
  /** False while no Tes Situasi Kerja rubric is active: no vacancy can take applicants then. Default true. */
  assessmentActive?: boolean;
}): { shown: SetupWarning[]; hidden: number } {
  const all: SetupWarning[] = [];

  if (input.assessmentActive === false) {
    all.push({ text: "Tes Situasi Kerja belum aktif, jadi tidak ada lowongan yang bisa menerima pelamar.", href: "/recruitment/assessment", actionLabel: "Buka rubrik" });
  }

  for (const t of input.types) {
    if (!t.active || t.activeQuestions > 0) continue;
    const usedBy = input.openVacancies.filter((v) => v.testTypeIds.includes(t.id)).length;
    if (!t.isGate && usedBy === 0) continue;
    all.push({
      text: `Tes ${t.name} belum punya soal${usedBy > 0 ? ` (dipakai ${usedBy} lowongan yang dibuka)` : ""}.`,
      href: `/recruitment/settings/tests/${t.id}`,
      actionLabel: "Isi soal",
    });
  }
  // The questions themselves are covered above; what is left per vacancy is e.g. a missing access code.
  for (const v of input.openVacancies) {
    for (const p of v.problems) {
      // Both are reported once above, not for every vacancy.
      if (/belum punya soal\.?$/.test(p) || p === ASSESSMENT_NOT_ACTIVE_PROBLEM) continue;
      all.push({ text: `${v.requestNumber}: ${p}`, href: `/recruitment/${v.id}`, actionLabel: "Buka" });
    }
  }
  return { shown: all.slice(0, MAX_WARNINGS), hidden: Math.max(0, all.length - MAX_WARNINGS) };
}

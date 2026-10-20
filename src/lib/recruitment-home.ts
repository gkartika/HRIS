// Pure rules for the Admin Rekrutmen Beranda: the "Perlu ditindak" list, the summary tiles and the
// setup warnings. No Prisma/Next imports, so it is unit testable. Severity and the waiting wording are
// shared with the Admin GA / Admin SDM Beranda (ga-home.ts).
import { DAY_MS, WIB_OFFSET_MS } from "@/lib/company-time";
import { daysSince, SEVERITY_RANK, sortTodo, waitingLabel, waitingSeverity, type Severity } from "@/lib/ga-home";
import { candidateNextStep, type CandidateProgress } from "@/lib/recruitment-candidates";
import type { RecruitmentCandidateStatus } from "@/generated/prisma/enums";

export type RecKind = "es" | "iv" | "of" | "mv";

export const REC_FILTERS: { key: RecKind | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "es", label: "Esai" },
  { key: "iv", label: "Interview" },
  { key: "of", label: "Offering" },
  { key: "mv", label: "Perubahan Posisi" },
];

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
  movementStatus: string | null;
  /** Passed a test with an "Istimewa" score. */
  excellent: boolean;
}

export interface RecRow {
  kind: RecKind;
  type: string;
  title: string;
  who: string;
  statusLabel: string;
  severity: Severity;
  /** Sort weight inside a severity: larger = needs attention sooner. */
  urgency: number;
  timeLabel: string;
  actionLabel: string;
  href: string;
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
export function interviewWhen(d: Date): string {
  const w = wibParts(d);
  const hh = String(w.getUTCHours()).padStart(2, "0");
  const mm = String(w.getUTCMinutes()).padStart(2, "0");
  return `${WEEKDAYS[w.getUTCDay()]}, ${shortDate(d)} ${hh}.${mm}`;
}

const candidateHref = (c: { requestId: string; id: string }) => `/recruitment/${c.requestId}/candidates/${c.id}`;
const who = (c: HomeCandidate) => `${c.requestNumber} · ${c.jobLabel}`;

function waitingRow(c: HomeCandidate | { statusChangedAt: Date }, now: Date) {
  const age = daysSince(c.statusChangedAt, now);
  return {
    age,
    severity: waitingSeverity(age),
    urgency: age,
    statusLabel: capitalize(waitingLabel(age)),
    timeLabel: age === 0 ? "" : `sejak ${shortDate(c.statusChangedAt)}`,
  };
}

// What is waiting for the recruiter, oldest first inside each colour. Applicants in the same
// step of the same request are shown as one row ("4 pelamar lolos tes").
export function buildRecruitmentRows(candidates: HomeCandidate[], now: Date): RecRow[] {
  const rows: RecRow[] = [];
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
    if (c.status === "INTERVIEWING") {
      if (!p.hasInterview) {
        rows.push({ kind: "iv", type: "Interview", title: `Jadwalkan interview — ${c.fullName}`, who: who(c), ...w, actionLabel: "Jadwalkan", href: candidateHref(c) });
      } else if (p.interviewersTotal > 0 && p.interviewersSubmitted >= p.interviewersTotal) {
        rows.push({
          kind: "iv",
          type: "Interview",
          title: `Putuskan hasil — ${c.fullName}`,
          who: `${who(c)} · ${p.interviewersSubmitted} dari ${p.interviewersTotal} pewawancara sudah mengisi`,
          ...w,
          actionLabel: "Putuskan",
          href: candidateHref(c),
        });
      } else if (c.interviewAt && c.interviewAt.getTime() > now.getTime() && c.interviewAt.getTime() - now.getTime() <= 7 * DAY_MS) {
        rows.push({
          kind: "iv",
          type: "Interview",
          title: `Interview ${interviewWhen(c.interviewAt)} — ${c.fullName}`,
          who: who(c),
          severity: "slate",
          urgency: -Math.round((c.interviewAt.getTime() - now.getTime()) / DAY_MS),
          statusLabel: "Terjadwal",
          timeLabel: shortDate(c.interviewAt),
          actionLabel: "Buka",
          href: candidateHref(c),
        });
      }
    } else if (c.status === "OFFERING") {
      const step = candidateNextStep(p);
      if (!step.needsAction) continue;
      const title = !p.hasOffer
        ? { t: `Unggah offering letter — ${c.fullName}`, a: "Unggah surat", extra: "" }
        : p.offerAccepted
          ? { t: `Jawaban offering diterima — ${c.fullName}`, a: "Buat karyawan", extra: " · siap dibuat data karyawan" }
          : { t: `Surat penawaran belum dikirim — ${c.fullName}`, a: "Kirim surat", extra: "" };
      rows.push({ kind: "of", type: "Offering", title: title.t, who: who(c) + title.extra, ...w, actionLabel: title.a, href: candidateHref(c) });
    } else if (c.status === "MOVEMENT") {
      if (!p.hasMovement) {
        rows.push({ kind: "mv", type: "Perubahan Posisi", title: `Ajukan Perubahan Posisi — ${c.fullName} (internal)`, who: who(c), ...w, actionLabel: "Ajukan", href: candidateHref(c) });
      } else if (c.movementStatus === "APPROVED") {
        rows.push({ kind: "mv", type: "Perubahan Posisi", title: `Jalankan perpindahan — ${c.fullName} (internal)`, who: `${who(c)} · sudah disetujui`, ...w, actionLabel: "Jalankan", href: candidateHref(c) });
      } else if (!p.movementOpen) {
        rows.push({ kind: "mv", type: "Perubahan Posisi", title: `Putuskan lagi — Perubahan Posisi ${c.fullName} tidak jalan`, who: who(c), ...w, actionLabel: "Buka", href: candidateHref(c) });
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
        type: "Esai",
        title: one ? `Pilih penilai esai — ${first.fullName}` : `Pilih penilai esai — ${g.items.length} pelamar`,
        who: who(first),
        ...w,
        actionLabel: "Pilih penilai",
        href: one ? candidateHref(first) : `/recruitment/${first.requestId}?stage=review`,
      });
    } else {
      rows.push({
        kind: "iv",
        type: "Interview",
        title: one ? `${first.fullName} lolos tes, siap diundang interview` : `${g.items.length} pelamar lolos tes, siap diundang interview`,
        who: `${who(first)}${special > 0 ? ` · ${special} berpredikat istimewa` : ""}`,
        ...w,
        actionLabel: "Atur interview",
        href: one ? candidateHref(first) : `/recruitment/${first.requestId}?stage=lolos`,
      });
    }
  }

  return sortTodo(rows);
}

// Rows the recruiter has to act on (a scheduled interview is only an FYI).
export function actionableCount(rows: RecRow[]): number {
  return rows.filter((r) => r.statusLabel !== "Terjadwal").length;
}

export function recRowCounts(rows: RecRow[]): Record<RecKind | "all", number> {
  const out: Record<RecKind | "all", number> = { all: rows.length, es: 0, iv: 0, of: 0, mv: 0 };
  for (const r of rows) out[r.kind] += 1;
  return out;
}

// ---------- tiles ----------

export interface HomeVacancy {
  id: string;
  requestNumber: string;
  jobLabel: string;
  openFor: "NONE" | "EXTERNAL" | "INTERNAL" | "BOTH";
  accessCode: string | null;
  /** Applicants still in the pipeline. */
  applicants: number;
  seatsLeft: number;
  /** What stops it from taking applicants (empty = ready). */
  problems: string[];
}

export interface Tile {
  title: string;
  total: number;
  severity: Severity;
  parts: { label: string; count: number; hint?: string }[];
  note: string | null;
  noteSevere: boolean;
  /** Which "Perlu ditindak" chip this tile can filter to. */
  filter: RecKind | null;
  openHref: string;
}

export interface LastMonth {
  hiredExternal: number;
  hiredInternal: number;
  avgDaysToHire: number | null;
}

const worst = (severities: Severity[]): Severity => [...severities].sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])[0] ?? "slate";

export function buildRecruitmentTiles(input: { candidates: HomeCandidate[]; rows: RecRow[]; vacancies: HomeVacancy[]; unopened: number; lastMonth: LastMonth; now: Date }): Tile[] {
  const { candidates, rows, vacancies, unopened, lastMonth, now } = input;
  const by = (status: RecruitmentCandidateStatus) => candidates.filter((c) => c.status === status);
  const keep = <T extends { count: number }>(parts: T[]) => parts.filter((p) => p.count > 0);
  const severityOf = (kind: RecKind) => worst(rows.filter((r) => r.kind === kind && r.statusLabel !== "Terjadwal").map((r) => r.severity));

  // 1. vacancies
  const open = vacancies.filter((v) => v.openFor !== "NONE");
  const notReady = open.filter((v) => v.problems.length > 0).length;
  const vacancyNotes = [unopened > 0 ? `${unopened} lowongan disetujui tapi belum dibuka untuk pelamar.` : null, notReady > 0 ? `${notReady} lowongan belum siap menerima pelamar.` : null].filter(Boolean);
  const vacancyTile: Tile = {
    title: "Lowongan dibuka",
    total: open.length,
    severity: unopened > 0 || notReady > 0 ? "amber" : "slate",
    parts: keep([
      { label: "Untuk pelamar eksternal", count: open.filter((v) => v.openFor === "EXTERNAL").length },
      { label: "Untuk karyawan (internal)", count: open.filter((v) => v.openFor === "INTERNAL").length },
      { label: "Eksternal dan internal", count: open.filter((v) => v.openFor === "BOTH").length },
    ]),
    note: vacancyNotes.length ? vacancyNotes.join(" ") : null,
    noteSevere: false,
    filter: null,
    openHref: "/recruitment",
  };

  // 2. tests and assessment
  const reviewNoReviewer = by("AWAITING_REVIEW").filter((c) => !c.progress.hasReviewer);
  const reviewOldest = reviewNoReviewer.length ? Math.max(...reviewNoReviewer.map((c) => daysSince(c.statusChangedAt, now))) : null;
  const reviewLate = reviewNoReviewer.filter((c) => daysSince(c.statusChangedAt, now) >= 5).length;
  const testsTotal = by("TESTING").length + by("AWAITING_REVIEW").length + by("TEST_PASSED").length;
  const testsSeverity = worst([severityOf("es"), worst(rows.filter((r) => r.kind === "iv" && r.title.includes("lolos tes")).map((r) => r.severity))]);
  const testsTile: Tile = {
    title: "Tes & penilaian",
    total: testsTotal,
    severity: testsSeverity,
    parts: keep([
      { label: "Sedang mengerjakan tes", count: by("TESTING").length },
      { label: "Esai menunggu penilai", count: reviewNoReviewer.length, hint: reviewOldest !== null && reviewOldest > 0 ? `terlama ${reviewOldest} hari` : undefined },
      { label: "Esai sedang dinilai", count: by("AWAITING_REVIEW").length - reviewNoReviewer.length },
      { label: "Lolos tes, siap diundang interview", count: by("TEST_PASSED").length },
    ]),
    note: reviewLate > 0 ? `${reviewLate} esai belum punya penilai lebih dari 5 hari.` : null,
    noteSevere: testsSeverity === "rose" && reviewLate > 0,
    filter: "es",
    openHref: "/recruitment/applicants",
  };

  // 3. interview
  const interviewing = by("INTERVIEWING");
  const decided = (c: HomeCandidate) => c.progress.interviewersTotal > 0 && c.progress.interviewersSubmitted >= c.progress.interviewersTotal;
  const interviewTile: Tile = {
    title: "Interview",
    total: interviewing.length,
    severity: severityOf("iv"),
    parts: keep([
      { label: "Belum dijadwalkan", count: interviewing.filter((c) => !c.progress.hasInterview).length },
      { label: "Terjadwal, belum berlangsung", count: interviewing.filter((c) => c.progress.hasInterview && !decided(c) && c.interviewAt !== null && c.interviewAt.getTime() > now.getTime()).length },
      { label: "Menunggu penilaian pewawancara", count: interviewing.filter((c) => c.progress.hasInterview && !decided(c) && !(c.interviewAt !== null && c.interviewAt.getTime() > now.getTime())).length },
      { label: "Selesai, menunggu keputusan HR", count: interviewing.filter(decided).length },
    ]),
    note: null,
    noteSevere: false,
    filter: "iv",
    openHref: "/recruitment/applicants?stage=interview",
  };

  // 4. offering
  const offering = by("OFFERING");
  const offeringTile: Tile = {
    title: "Offering",
    total: offering.length,
    severity: severityOf("of"),
    parts: keep([
      { label: "Surat belum diunggah", count: offering.filter((c) => !c.progress.hasOffer).length },
      { label: "Surat belum dikirim", count: offering.filter((c) => c.progress.hasOffer && !c.progress.offerSent && !c.progress.offerAccepted).length },
      { label: "Menunggu jawaban pelamar", count: offering.filter((c) => c.progress.offerSent && !c.progress.offerAccepted).length },
      { label: "Diterima, siap dibuat data karyawan", count: offering.filter((c) => c.progress.offerAccepted).length },
    ]),
    note: null,
    noteSevere: false,
    filter: "of",
    openHref: "/recruitment/applicants?stage=offering",
  };

  // 5. internal move
  const moving = by("MOVEMENT");
  const movementTile: Tile = {
    title: "Perubahan Posisi (internal)",
    total: moving.length,
    severity: severityOf("mv"),
    parts: keep([
      { label: "Perlu diajukan", count: moving.filter((c) => !c.progress.hasMovement).length },
      { label: "Menunggu persetujuan", count: moving.filter((c) => c.progress.movementOpen && c.movementStatus !== "APPROVED").length },
      { label: "Disetujui, siap dijalankan", count: moving.filter((c) => c.movementStatus === "APPROVED").length },
      { label: "Tidak jalan, perlu diputuskan lagi", count: moving.filter((c) => c.progress.hasMovement && !c.progress.movementOpen).length },
    ]),
    note: null,
    noteSevere: false,
    filter: "mv",
    openHref: "/recruitment/applicants?stage=offering",
  };

  // 6. hired in the last 30 days
  const hiredTotal = lastMonth.hiredExternal + lastMonth.hiredInternal;
  const hiredTile: Tile = {
    title: "Diterima 30 hari terakhir",
    total: hiredTotal,
    severity: "slate",
    parts: [
      { label: "Karyawan baru (eksternal)", count: lastMonth.hiredExternal },
      { label: "Promosi / mutasi (internal)", count: lastMonth.hiredInternal },
    ],
    note: lastMonth.avgDaysToHire !== null ? `Rata-rata ${lastMonth.avgDaysToHire.toLocaleString("id-ID")} hari dari melamar sampai diterima.` : null,
    noteSevere: false,
    filter: null,
    openHref: "/recruitment/dashboard",
  };

  return [vacancyTile, testsTile, interviewTile, offeringTile, movementTile, hiredTile];
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
}): { shown: SetupWarning[]; hidden: number } {
  const all: SetupWarning[] = [];

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
      if (/belum punya soal\.?$/.test(p) || p.startsWith("Belum ada tes gerbang")) continue;
      all.push({ text: `${v.requestNumber}: ${p}`, href: `/recruitment/${v.id}`, actionLabel: "Buka" });
    }
  }
  return { shown: all.slice(0, MAX_WARNINGS), hidden: Math.max(0, all.length - MAX_WARNINGS) };
}

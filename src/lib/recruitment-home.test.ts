import { describe, expect, it } from "vitest";
import { ASSESSMENT_NOT_ACTIVE_PROBLEM } from "./recruitment-candidates";
import {
  buildHomeStats,
  buildRecruitmentRows,
  buildSetupWarnings,
  buildUpcomingInterviews,
  buildVacancyProgress,
  buildWaitingItems,
  recRowCounts,
  type HomeCandidate,
  type HomeRequest,
} from "./recruitment-home";
import type { CandidateProgress } from "./recruitment-candidates";

const now = new Date("2026-10-20T05:00:00Z"); // 12:00 WIB
const ago = (days: number) => new Date(now.getTime() - days * 86400000);
const at = (hours: number) => new Date(now.getTime() + hours * 3600000);

function progress(over: Partial<CandidateProgress> = {}): CandidateProgress {
  return {
    status: "TESTING",
    hasReviewer: false,
    hasInterview: false,
    interviewersTotal: 0,
    interviewersSubmitted: 0,
    hasOffer: false,
    offerSent: false,
    offerAccepted: false,
    hasMovement: false,
    movementOpen: false,
    ...over,
  };
}

function cand(id: string, status: HomeCandidate["status"], over: Partial<HomeCandidate> & { p?: Partial<CandidateProgress> } = {}): HomeCandidate {
  const { p, ...rest } = over;
  return {
    id,
    requestId: "r1",
    requestNumber: "REQ-0042",
    jobLabel: "Operator Produksi",
    fullName: `Pelamar ${id}`,
    status,
    statusChangedAt: ago(1),
    progress: progress({ status, ...p }),
    interviewAt: null,
    interviewMode: null,
    offerSentAt: null,
    movementStatus: null,
    excellent: false,
    ...rest,
  };
}

const request = (id: string, over: Partial<HomeRequest> = {}): HomeRequest => ({
  id,
  requestNumber: `REQ-${id}`,
  jobLabel: `Job ${id}`,
  department: "Produksi",
  headcount: 2,
  filled: 0,
  approvedAt: ago(1),
  heldAt: null,
  opened: true,
  hasDetail: true,
  problems: [],
  totalApplicants: 0,
  ...over,
});

describe("buildRecruitmentRows", () => {
  it("groups applicants waiting in the same step of the same request", () => {
    const rows = buildRecruitmentRows(
      [cand("a", "TEST_PASSED", { statusChangedAt: ago(4) }), cand("b", "TEST_PASSED", { excellent: true }), cand("c", "TEST_PASSED", { requestId: "r2", requestNumber: "REQ-0044" })],
      now
    );
    expect(rows).toHaveLength(2);
    const group = rows.find((r) => r.who.startsWith("REQ-0042"));
    expect(group).toMatchObject({ kind: "iv", type: "Undang interview", title: "2 pelamar lolos tes", requestId: "r1" });
    expect(group?.who).toContain("1 berpredikat istimewa");
    expect(group?.statusLabel).toBe("Menunggu 4 hari");
    expect(group?.severity).toBe("amber");
    expect(group?.href).toBe("/recruitment/r1?stage=lolos");
    const single = rows.find((r) => r.who.startsWith("REQ-0044"));
    expect(single?.title).toBe("Pelamar c");
    expect(single?.href).toBe("/recruitment/r2/candidates/c");
  });

  it("an essay with a reviewer already is not the recruiter's task", () => {
    expect(buildRecruitmentRows([cand("a", "AWAITING_REVIEW", { p: { hasReviewer: true } })], now)).toEqual([]);
    const rows = buildRecruitmentRows([cand("a", "AWAITING_REVIEW", { statusChangedAt: ago(8) })], now);
    expect(rows[0]).toMatchObject({ kind: "es", severity: "rose", actionLabel: "Pilih penilai" });
  });

  it("interview steps: schedule and decide; a scheduled or running interview is not a task", () => {
    const rows = buildRecruitmentRows(
      [
        cand("a", "INTERVIEWING"),
        cand("b", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 2 } }),
        cand("c", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 0 }, interviewAt: at(20) }),
        // interview is done, but interviewers still have to fill in: nothing for the recruiter
        cand("d", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 1 }, interviewAt: ago(1) }),
      ],
      now
    );
    expect(rows.map((r) => r.actionLabel).sort()).toEqual(["Jadwalkan", "Putuskan"]);
  });

  it("offering and internal move rows", () => {
    const rows = buildRecruitmentRows(
      [
        cand("a", "OFFERING"),
        cand("b", "OFFERING", { p: { hasOffer: true } }),
        cand("c", "OFFERING", { p: { hasOffer: true, offerSent: true } }), // waiting for the applicant
        cand("d", "OFFERING", { p: { hasOffer: true, offerSent: true, offerAccepted: true } }),
        cand("e", "MOVEMENT"),
        cand("f", "MOVEMENT", { p: { hasMovement: true, movementOpen: true }, movementStatus: "APPROVED" }),
        cand("g", "MOVEMENT", { p: { hasMovement: true, movementOpen: true }, movementStatus: "SUBMITTED" }), // waiting for approvers
        cand("h", "MOVEMENT", { p: { hasMovement: true, movementOpen: false }, movementStatus: "REJECTED" }),
      ],
      now
    );
    expect(rows.map((r) => r.actionLabel).sort()).toEqual(["Ajukan", "Buat karyawan", "Buka", "Jalankan", "Kirim surat", "Unggah surat"]);
    expect(recRowCounts(rows)).toEqual({ all: 6, vc: 0, es: 0, iv: 0, of: 3, mv: 3 });
  });

  it("puts the longest wait first", () => {
    const rows = buildRecruitmentRows([cand("a", "OFFERING", { statusChangedAt: ago(1) }), cand("b", "OFFERING", { statusChangedAt: ago(9) })], now);
    expect(rows[0].title).toBe("Pelamar b");
    expect(rows[0].severity).toBe("rose");
  });

  it("approved requests that are not open yet: write the detail first, then open; held and full ones are skipped", () => {
    const rows = buildRecruitmentRows(
      [],
      now,
      [
        request("a", { opened: false, hasDetail: false, approvedAt: ago(5) }),
        request("b", { opened: false, hasDetail: true, approvedAt: ago(1) }),
        request("c", { opened: false, heldAt: ago(1) }),
        request("d", { opened: false, filled: 2 }),
        request("e", { opened: true }),
      ]
    );
    expect(rows.map((r) => [r.requestId, r.type, r.kind])).toEqual([
      ["a", "Tulis detail lowongan", "vc"],
      ["b", "Buka lowongan", "vc"],
    ]);
    expect(rows[0]).toMatchObject({ severity: "amber", statusLabel: "Menunggu 5 hari", href: "/recruitment/a", title: "Job a" });
  });
});

describe("buildWaitingItems", () => {
  it("lists what waits for someone else, oldest first, and groups applicants still testing", () => {
    const items = buildWaitingItems(
      [
        cand("a", "OFFERING", { p: { hasOffer: true, offerSent: true }, offerSentAt: ago(4) }),
        cand("b", "AWAITING_REVIEW", { p: { hasReviewer: true }, statusChangedAt: ago(2) }),
        cand("c", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 1 }, interviewAt: ago(3) }),
        cand("d", "TESTING", { statusChangedAt: ago(1) }),
        cand("e", "TESTING", { statusChangedAt: ago(6) }),
        cand("f", "MOVEMENT", { p: { hasMovement: true, movementOpen: true }, movementStatus: "SUBMITTED" }),
        // a task for the recruiter, not a wait
        cand("g", "OFFERING", { p: { hasOffer: true } }),
      ],
      now
    );
    expect(items.map((i) => i.title)).toEqual([
      "Pelamar belum selesai mengerjakan tes",
      "Offering menunggu jawaban",
      "Pewawancara belum mengisi penilaian",
      "Penilai esai belum selesai menilai",
      "Perubahan Posisi menunggu persetujuan",
    ]);
    expect(items[0]).toMatchObject({ detail: "2 pelamar · REQ-0042 · Operator Produksi", severity: "amber", age: 6 });
    expect(items[2].detail).toContain("1 dari 2 pewawancara sudah mengisi");
  });
});

describe("buildUpcomingInterviews", () => {
  it("lists the coming 7 days in time order with day label and interviewers", () => {
    const list = buildUpcomingInterviews(
      [
        cand("far", "INTERVIEWING", { interviewAt: at(24 * 9), p: { hasInterview: true } }),
        cand("tomorrow", "INTERVIEWING", { interviewAt: at(20), interviewMode: "ONLINE", p: { hasInterview: true, interviewersTotal: 2 } }),
        cand("today", "INTERVIEWING", { interviewAt: at(2), p: { hasInterview: true } }),
        cand("past", "INTERVIEWING", { interviewAt: ago(1), p: { hasInterview: true } }),
        cand("later", "INTERVIEWING", { interviewAt: at(24 * 3), p: { hasInterview: true, interviewersTotal: 1 } }),
      ],
      now
    );
    expect(list.map((i) => i.id)).toEqual(["today", "tomorrow", "later"]);
    expect(list[0]).toMatchObject({ dayLabel: "Hari ini · Selasa, 20 Okt", time: "14.00", needsInterviewer: true, interviewersLabel: "Belum ada pewawancara", modeLabel: null });
    expect(list[1]).toMatchObject({ dayLabel: "Besok · Rabu, 21 Okt", time: "08.00", modeLabel: "Online", interviewersLabel: "2 pewawancara", needsInterviewer: false });
    expect(list[2].dayLabel).toBe("Jumat, 23 Okt");
  });
});

describe("buildVacancyProgress and buildHomeStats", () => {
  const candidates = [
    cand("a", "TESTING"),
    cand("b", "TEST_PASSED"),
    cand("c", "INTERVIEWING"),
    cand("d", "OFFERING", { p: { hasOffer: true, offerSent: true } }),
    cand("e", "MOVEMENT", { p: { hasMovement: true, movementOpen: true }, movementStatus: "SUBMITTED" }),
    cand("x", "TESTING", { requestId: "r2", requestNumber: "REQ-0050" }),
  ];
  const requests = [
    request("r1", { filled: 1, totalApplicants: 9, approvedAt: ago(12) }),
    request("r2", { totalApplicants: 1 }),
    request("r3", { opened: false, hasDetail: false, headcount: 1 }),
    request("r4", { heldAt: ago(2), headcount: 5 }),
    request("r5", { problems: ["Kode akses untuk pelamar eksternal belum dibuat."] }),
  ];
  const rows = buildRecruitmentRows(candidates, now, requests);
  const waiting = buildWaitingItems(candidates, now);
  const progressList = buildVacancyProgress({ requests, candidates, rows, waiting, now });
  const byId = (id: string) => progressList.find((v) => v.id === id)!;

  it("counts the applicants in each step and the seats filled", () => {
    expect(byId("r1").stages).toEqual([
      { label: "Tes", count: 1 },
      { label: "Review", count: 0 },
      { label: "Lolos tes", count: 1 },
      { label: "Interview", count: 1 },
      { label: "Offering", count: 2 },
      { label: "Terisi", count: 1 },
    ]);
    expect(byId("r1")).toMatchObject({ filled: 1, headcount: 2, totalApplicants: 9, state: "open", approvedDays: 12 });
  });

  it("says the next step from the recruiter's own tasks first, then what blocks it, then what is awaited", () => {
    // r1 has two tasks (invite the passed applicant, schedule the interview): the longest waiting comes first
    expect(byId("r1").next.text).toMatch(/^2 hal perlu Anda kerjakan\. Mulai dari: /);
    expect(byId("r3").next).toMatchObject({ text: "Tulis detail lowongan: Job r3", severity: "slate" });
    expect(byId("r4").next.text).toContain("Ditahan");
    expect(byId("r5").next).toMatchObject({ text: "Belum siap menerima pelamar: Kode akses untuk pelamar eksternal belum dibuat.", severity: "amber" });
    expect(byId("r2").next.text).toBe("Menunggu pihak lain: pelamar belum selesai mengerjakan tes");
  });

  it("puts held vacancies last", () => {
    expect(progressList[progressList.length - 1].id).toBe("r4");
  });

  it("the four numbers leave out held vacancies", () => {
    const upcoming = buildUpcomingInterviews([cand("t", "INTERVIEWING", { interviewAt: at(20), p: { hasInterview: true } })], now);
    const stats = buildHomeStats({ rows, upcoming, waiting, vacancies: progressList, now });
    expect(stats).toMatchObject({ todo: rows.length, interviews: 1, interviewsToday: 0, interviewsTomorrow: 1, waiting: waiting.length });
    expect(stats.headcount).toBe(2 + 2 + 1 + 2);
    expect(stats.filled).toBe(1);
  });
});

describe("buildSetupWarnings", () => {
  const types = [
    { id: "cf", name: "Cultural Fit", isGate: true, active: true, activeQuestions: 0 },
    { id: "ld", name: "Logika Dasar", isGate: false, active: true, activeQuestions: 0 },
    { id: "sk", name: "Studi Kasus", isGate: false, active: true, activeQuestions: 0 },
    { id: "kt", name: "Ketelitian", isGate: false, active: true, activeQuestions: 30 },
  ];

  it("warns about the gate always, about other tests only when an open vacancy uses them", () => {
    const { shown } = buildSetupWarnings({
      types,
      openVacancies: [{ id: "v1", requestNumber: "REQ-1", testTypeIds: ["cf", "ld"], problems: ["Tes Cultural Fit belum punya soal.", "Tes Logika Dasar belum punya soal.", "Kode akses untuk pelamar eksternal belum dibuat."] }],
    });
    expect(shown.map((w) => w.text)).toEqual([
      "Tes Cultural Fit belum punya soal (dipakai 1 lowongan yang dibuka).",
      "Tes Logika Dasar belum punya soal (dipakai 1 lowongan yang dibuka).",
      "REQ-1: Kode akses untuk pelamar eksternal belum dibuat.",
    ]);
    expect(shown[0].href).toBe("/recruitment/settings/tests/cf");
    expect(shown[2].href).toBe("/recruitment/v1");
  });

  it("says once that Tes Situasi Kerja is not active, and does not repeat it per vacancy", () => {
    const { shown } = buildSetupWarnings({
      types: [],
      assessmentActive: false,
      openVacancies: [{ id: "v1", requestNumber: "REQ-1", testTypeIds: [], problems: [ASSESSMENT_NOT_ACTIVE_PROBLEM] }],
    });
    expect(shown).toHaveLength(1);
    expect(shown[0].text).toContain("Tes Situasi Kerja belum aktif");
    expect(shown[0].href).toBe("/recruitment/assessment");
    expect(buildSetupWarnings({ types: [], openVacancies: [] }).shown).toEqual([]);
  });

  it("is empty when everything is ready, and caps a long list", () => {
    expect(buildSetupWarnings({ types: [{ ...types[0], activeQuestions: 5 }], openVacancies: [] })).toEqual({ shown: [], hidden: 0 });
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `v${i}`, requestNumber: `REQ-${i}`, testTypeIds: [], problems: ["Jabatan pada permintaan ini belum ditentukan."] }));
    const out = buildSetupWarnings({ types: [], openVacancies: many });
    expect(out.shown).toHaveLength(4);
    expect(out.hidden).toBe(3);
  });
});

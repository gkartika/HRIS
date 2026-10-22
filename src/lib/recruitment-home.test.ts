import { describe, expect, it } from "vitest";
import { actionableCount, buildRecruitmentRows, buildRecruitmentTiles, buildSetupWarnings, buildUnopenedRequests, recRowCounts, type HomeCandidate, type HomeVacancy } from "./recruitment-home";
import type { CandidateProgress } from "./recruitment-candidates";

const now = new Date("2026-10-20T05:00:00Z"); // 12:00 WIB
const ago = (days: number) => new Date(now.getTime() - days * 86400000);

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
    movementStatus: null,
    excellent: false,
    ...rest,
  };
}

describe("buildRecruitmentRows", () => {
  it("groups applicants waiting in the same step of the same request", () => {
    const rows = buildRecruitmentRows(
      [cand("a", "TEST_PASSED", { statusChangedAt: ago(4) }), cand("b", "TEST_PASSED", { excellent: true }), cand("c", "TEST_PASSED", { requestId: "r2", requestNumber: "REQ-0044" })],
      now
    );
    expect(rows).toHaveLength(2);
    const group = rows.find((r) => r.who.startsWith("REQ-0042"));
    expect(group?.title).toBe("2 pelamar lolos tes, siap diundang interview");
    expect(group?.who).toContain("1 berpredikat istimewa");
    expect(group?.statusLabel).toBe("Menunggu 4 hari");
    expect(group?.severity).toBe("amber");
    expect(group?.href).toBe("/recruitment/r1?stage=lolos");
    const single = rows.find((r) => r.who.startsWith("REQ-0044"));
    expect(single?.title).toBe("Pelamar c lolos tes, siap diundang interview");
    expect(single?.href).toBe("/recruitment/r2/candidates/c");
  });

  it("an essay with a reviewer already is not the recruiter's task", () => {
    expect(buildRecruitmentRows([cand("a", "AWAITING_REVIEW", { p: { hasReviewer: true } })], now)).toEqual([]);
    const rows = buildRecruitmentRows([cand("a", "AWAITING_REVIEW", { statusChangedAt: ago(8) })], now);
    expect(rows[0]).toMatchObject({ kind: "es", severity: "rose", actionLabel: "Pilih penilai" });
  });

  it("interview steps: schedule, wait, decide, and an upcoming one", () => {
    const rows = buildRecruitmentRows(
      [
        cand("a", "INTERVIEWING"),
        cand("b", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 2 } }),
        cand("c", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 0 }, interviewAt: new Date(now.getTime() + 20 * 3600000) }),
        // interview is done, but interviewers still have to fill in: nothing for the recruiter
        cand("d", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 1 }, interviewAt: ago(1) }),
        // too far away to list
        cand("e", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 0 }, interviewAt: new Date(now.getTime() + 20 * 86400000) }),
      ],
      now
    );
    expect(rows.map((r) => r.actionLabel).sort()).toEqual(["Buka", "Jadwalkan", "Putuskan"]);
    const upcoming = rows.find((r) => r.statusLabel === "Terjadwal");
    expect(upcoming?.title).toBe("Interview Rabu, 21 Okt 08.00 — Pelamar c");
    expect(upcoming?.severity).toBe("slate");
    expect(actionableCount(rows)).toBe(2);
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
    expect(recRowCounts(rows)).toEqual({ all: 6, es: 0, iv: 0, of: 3, mv: 3 });
  });

  it("puts the longest wait first", () => {
    const rows = buildRecruitmentRows([cand("a", "OFFERING", { statusChangedAt: ago(1) }), cand("b", "OFFERING", { statusChangedAt: ago(9) })], now);
    expect(rows[0].title).toContain("Pelamar b");
    expect(rows[0].severity).toBe("rose");
  });
});

describe("buildRecruitmentTiles", () => {
  const vacancy = (id: string, openFor: HomeVacancy["openFor"], problems: string[] = []): HomeVacancy => ({
    id,
    requestNumber: `REQ-${id}`,
    jobLabel: "Operator",
    openFor,
    accessCode: null,
    applicants: 0,
    seatsLeft: 1,
    problems,
  });

  const candidates = [
    cand("a", "TESTING"),
    cand("b", "AWAITING_REVIEW", { statusChangedAt: ago(6) }),
    cand("c", "AWAITING_REVIEW", { p: { hasReviewer: true } }),
    cand("d", "TEST_PASSED"),
    cand("e", "INTERVIEWING", { p: { hasInterview: true, interviewersTotal: 2, interviewersSubmitted: 2 } }),
    cand("f", "OFFERING", { p: { hasOffer: true, offerSent: true } }),
  ];
  const rows = buildRecruitmentRows(candidates, now);
  const tiles = buildRecruitmentTiles({
    candidates,
    rows,
    vacancies: [vacancy("1", "EXTERNAL"), vacancy("2", "BOTH", ["Tes X belum punya soal."]), vacancy("3", "NONE")],
    unopened: 1,
    lastMonth: { hiredExternal: 5, hiredInternal: 2, avgDaysToHire: 27.2 },
    now,
  });
  const tile = (title: string) => tiles.find((t) => t.title === title)!;

  it("has the six tiles in order", () => {
    expect(tiles.map((t) => t.title)).toEqual(["Lowongan dibuka", "Tes & penilaian", "Interview", "Offering", "Perubahan Posisi (internal)", "Diterima 30 hari terakhir"]);
  });

  it("vacancies: counts the open ones and says what is off", () => {
    const t = tile("Lowongan dibuka");
    expect(t.total).toBe(2);
    expect(t.severity).toBe("amber");
    expect(t.note).toContain("1 lowongan disetujui tapi belum dibuka");
    expect(t.note).toContain("1 lowongan belum siap");
  });

  it("tests: splits the steps and hides empty ones", () => {
    const t = tile("Tes & penilaian");
    expect(t.total).toBe(4);
    expect(t.parts.map((p) => [p.label, p.count])).toEqual([
      ["Sedang mengerjakan tes", 1],
      ["Esai menunggu penilai", 1],
      ["Esai sedang dinilai", 1],
      ["Lolos tes, siap diundang interview", 1],
    ]);
    expect(t.parts[1].hint).toBe("terlama 6 hari");
    expect(t.note).toBe("1 esai belum punya penilai lebih dari 5 hari.");
    expect(t.severity).toBe("amber"); // waiting 6 days: red starts at 7
    expect(t.noteSevere).toBe(false);
  });

  it("offering waiting for the applicant is counted but quiet", () => {
    const t = tile("Offering");
    expect(t.total).toBe(1);
    expect(t.parts).toEqual([{ label: "Menunggu jawaban pelamar", count: 1 }]);
    expect(t.severity).toBe("slate");
  });

  it("hired tile", () => {
    const t = tile("Diterima 30 hari terakhir");
    expect(t.total).toBe(7);
    expect(t.note).toContain("27,2");
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

  it("is empty when everything is ready, and caps a long list", () => {
    expect(buildSetupWarnings({ types: [{ ...types[0], activeQuestions: 5 }], openVacancies: [] })).toEqual({ shown: [], hidden: 0 });
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `v${i}`, requestNumber: `REQ-${i}`, testTypeIds: [], problems: ["Jabatan pada permintaan ini belum ditentukan."] }));
    const out = buildSetupWarnings({ types: [], openVacancies: many });
    expect(out.shown).toHaveLength(4);
    expect(out.hidden).toBe(3);
  });
});

describe("buildUnopenedRequests", () => {
  const req = (id: string, approvedDaysAgo: number | null, held = false) => ({
    id,
    requestNumber: `REQ-${id}`,
    jobLabel: `Job ${id}`,
    department: "Produksi",
    seatsLeft: 1,
    approvedAt: approvedDaysAgo === null ? null : ago(approvedDaysAgo),
    heldAt: held ? ago(1) : null,
  });

  it("puts the longest waiting first and shows how long", () => {
    const list = buildUnopenedRequests([req("a", 1), req("b", 5), req("c", 0)], now);
    expect(list.map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(list[0].waitingLabel).toBe("menunggu 5 hari");
    expect(list[2].waitingLabel).toBe("baru hari ini");
  });

  it("colours by waiting time: quiet, amber from 3 days, rose from 7", () => {
    const [a, b, c] = buildUnopenedRequests([req("a", 7), req("b", 3), req("c", 1)], now);
    expect([a.severity, b.severity, c.severity]).toEqual(["rose", "amber", "slate"]);
  });

  it("held requests go last, quiet and marked held", () => {
    const list = buildUnopenedRequests([req("held", 9, true), req("open", 1)], now);
    expect(list.map((r) => r.id)).toEqual(["open", "held"]);
    expect(list[1]).toMatchObject({ held: true, severity: "slate" });
  });

  it("a request without an approval date counts as new", () => {
    expect(buildUnopenedRequests([req("x", null)], now)[0].waitingLabel).toBe("baru hari ini");
  });
});

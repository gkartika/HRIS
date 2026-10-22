import { describe, expect, it } from "vitest";
import {
  accessCodeMatches,
  averageScore,
  candidateNextStep,
  canStartTest,
  countDecisions,
  deriveStatusFromTests,
  fillTemplate,
  formatClock,
  generateAccessCode,
  isExpired,
  isPassing,
  isValidEmail,
  isValidMobile,
  mobileProblem,
  formatMobile,
  validateApplicantFile,
  isValidSignatureDataUrl,
  normalizeAccessCode,
  normalizeEmail,
  normalizeMobile,
  parseBulkQuestions,
  describeTestSteps,
  isAnchoredOption,
  groupTestColumns,
  isExcellent,
  testIdsForRequest,
  optionDisplayOrder,
  pickVariants,
  planTestsForJob,
  possibleTestsForJob,
  testDisplayName,
  reapplyBlock,
  scoreTest,
  secondsLeft,
  validateCvFile,
  validateOfferFile,
  whatsappLink,
  type CandidateProgress,
} from "./recruitment-candidates";

const NOW = new Date("2026-10-19T03:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("applicant contact details", () => {
  it("lowercases and trims emails and checks their shape", () => {
    expect(normalizeEmail("  Rina.M@Mail.COM ")).toBe("rina.m@mail.com");
    expect(isValidEmail("rina@mail.com")).toBe(true);
    expect(isValidEmail("rina@mail")).toBe(false);
    expect(isValidEmail("rina mail@x.com")).toBe(false);
  });

  it("turns Indonesian numbers into the international form", () => {
    expect(normalizeMobile("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeMobile("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeMobile("81234567890")).toBe("6281234567890");
    expect(isValidMobile("08123")).toBe(false);
    expect(isValidMobile("081234567890")).toBe(true);
  });

  it("accepts every way of typing the same Indonesian mobile number", () => {
    for (const typed of ["0812-3456-7890", "+62 812 3456 7890", "62812.3456.7890", "(0812) 3456 7890", "812 3456 7890", " 0812 3456 7890 "]) {
      expect(normalizeMobile(typed)).toBe("6281234567890");
      expect(mobileProblem(typed)).toBeNull();
    }
  });

  it("refuses short, landline, foreign and empty numbers with a reason", () => {
    expect(mobileProblem("0812 3456")).toMatch(/pendek/);
    expect(mobileProblem("0812 3456 7890 1234 5")).toMatch(/panjang/);
    expect(mobileProblem("021 555 1234")).toMatch(/seluler/);
    expect(mobileProblem("+1 415 555 0100")).toMatch(/Indonesia/);
    expect(mobileProblem("")).toMatch(/Isi/);
  });

  it("shows a stored number the same way everywhere", () => {
    expect(formatMobile("6281234567890")).toBe("+62 812-3456-7890");
    expect(formatMobile("62811123456")).toBe("+62 811-123-456");
    expect(formatMobile("628123456789012")).toBe("+62 812-3456-789012");
  });

  it("checks the supporting document like the CV, with its own name in the message", () => {
    expect(validateApplicantFile({ name: "ijazah.pdf", size: 1000, type: "application/pdf" }, "dokumen pendukung")).toBeNull();
    expect(validateApplicantFile({ name: "ijazah.exe", size: 1000, type: "application/octet-stream" }, "dokumen pendukung")).toMatch(/dokumen pendukung/);
  });

  it("builds a WhatsApp link with the message encoded", () => {
    expect(whatsappLink("0812 3456 7890", "Halo & selamat")).toBe("https://wa.me/6281234567890?text=Halo%20%26%20selamat");
  });
});

describe("access codes", () => {
  it("generates codes in the CBP-XXXX-XXXX shape without look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^CBP-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    }
    expect(generateAccessCode()).not.toBe(generateAccessCode());
  });

  it("accepts the code in any case with stray spaces, and refuses anything else", () => {
    expect(normalizeAccessCode(" cbp-ab12 -cd34 ")).toBe("CBP-AB12-CD34");
    expect(accessCodeMatches("CBP-AB12-CD34", " cbp-ab12-cd34 ")).toBe(true);
    expect(accessCodeMatches("CBP-AB12-CD34", "CBP-AB12-CD35")).toBe(false);
    expect(accessCodeMatches("CBP-AB12-CD34", "")).toBe(false);
    expect(accessCodeMatches(null, "CBP-AB12-CD34")).toBe(false);
  });
});

describe("re-applying", () => {
  it("blocks a second live application for the same vacancy only", () => {
    const prior = [{ requestId: "r1", status: "TESTING" as const, closedAt: null }];
    expect(reapplyBlock(prior, "r1", NOW, 30).blocked).toBe(true);
    expect(reapplyBlock(prior, "r2", NOW, 30).blocked).toBe(false);
  });

  it("makes someone wait after failing the tests or being rejected, on any vacancy", () => {
    const failed = [{ requestId: "r1", status: "TEST_FAILED" as const, closedAt: daysAgo(10) }];
    const res = reapplyBlock(failed, "r2", NOW, 30);
    expect(res.blocked).toBe(true);
    expect(reapplyBlock(failed, "r2", NOW, 5).blocked).toBe(false);
    const rejected = [{ requestId: "r1", status: "REJECTED" as const, closedAt: daysAgo(31) }];
    expect(reapplyBlock(rejected, "r1", NOW, 30).blocked).toBe(false);
  });

  it("does not make anyone wait after declining an offer or losing out to someone else", () => {
    const prior = [
      { requestId: "r1", status: "OFFER_DECLINED" as const, closedAt: daysAgo(1) },
      { requestId: "r1", status: "NOT_SELECTED" as const, closedAt: daysAgo(1) },
    ];
    expect(reapplyBlock(prior, "r1", NOW, 30).blocked).toBe(false);
  });

  it("uses the longest remaining wait when there are several", () => {
    const prior = [
      { requestId: "r1", status: "TEST_FAILED" as const, closedAt: daysAgo(25) },
      { requestId: "r2", status: "REJECTED" as const, closedAt: daysAgo(2) },
    ];
    const res = reapplyBlock(prior, "r3", NOW, 30);
    expect(res.blocked).toBe(true);
    if (res.blocked) expect(res.message).toContain("November 2026");
  });
});

describe("scoring", () => {
  const mc = [
    { id: "a", correctIndex: 1, reverseScored: false },
    { id: "b", correctIndex: 0, reverseScored: false },
    { id: "c", correctIndex: 2, reverseScored: false },
    { id: "d", correctIndex: 3, reverseScored: false },
  ];

  it("scores multiple choice as the share of correct answers", () => {
    const answers = new Map<string, number | null>([["a", 1], ["b", 0], ["c", 0], ["d", null]]);
    expect(scoreTest("MULTIPLE_CHOICE", mc, answers)).toBe(50);
    expect(scoreTest("MULTIPLE_CHOICE", mc, new Map())).toBe(0);
  });

  it("scores scale answers from 0 (all 1s) to 100 (all 5s)", () => {
    const qs = [
      { id: "a", correctIndex: null, reverseScored: false },
      { id: "b", correctIndex: null, reverseScored: false },
    ];
    expect(scoreTest("SCALE", qs, new Map([["a", 5], ["b", 5]]))).toBe(100);
    expect(scoreTest("SCALE", qs, new Map([["a", 1], ["b", 1]]))).toBe(0);
    expect(scoreTest("SCALE", qs, new Map([["a", 3], ["b", 5]]))).toBe(75);
  });

  it("flips reverse-worded statements and counts blanks as the lowest answer", () => {
    const qs = [
      { id: "a", correctIndex: null, reverseScored: false },
      { id: "b", correctIndex: null, reverseScored: true },
    ];
    expect(scoreTest("SCALE", qs, new Map([["a", 5], ["b", 1]]))).toBe(100);
    expect(scoreTest("SCALE", qs, new Map([["a", 5]]))).toBe(50);
  });

  it("returns 0 for an essay or an empty bank", () => {
    expect(scoreTest("ESSAY", mc, new Map())).toBe(0);
    expect(scoreTest("SCALE", [], new Map())).toBe(0);
  });

  it("passes at or above the pass mark", () => {
    expect(isPassing(70, 70)).toBe(true);
    expect(isPassing(69.9, 70)).toBe(false);
  });
});

describe("overall test status", () => {
  const done = (passed: boolean | null) => ({ status: "SUBMITTED" as const, passed });
  const waiting = { status: "NOT_STARTED" as const, passed: null };

  it("fails as soon as any test failed, even if others are unfinished", () => {
    expect(deriveStatusFromTests([done(false), waiting])).toBe("TEST_FAILED");
  });
  it("stays TESTING while a test is not submitted", () => {
    expect(deriveStatusFromTests([done(true), { status: "IN_PROGRESS", passed: null }])).toBe("TESTING");
  });
  it("waits for review when only an essay is ungraded", () => {
    expect(deriveStatusFromTests([done(true), done(null)])).toBe("AWAITING_REVIEW");
  });
  it("passes when everything is submitted and passed", () => {
    expect(deriveStatusFromTests([done(true), done(true)])).toBe("TEST_PASSED");
  });
});

describe("planning and ordering tests", () => {
  const types = [
    { id: "kt", isGate: false, sortOrder: 2, active: true },
    { id: "cf", isGate: true, sortOrder: 1, active: true },
    { id: "sk", isGate: false, sortOrder: 3, active: true },
    { id: "old", isGate: false, sortOrder: 4, active: false },
  ];
  it("puts the gate first and keeps only the job's tests", () => {
    expect(planTestsForJob(types, ["sk", "kt"]).map((t) => t.id)).toEqual(["cf", "kt", "sk"]);
    expect(planTestsForJob(types, []).map((t) => t.id)).toEqual(["cf"]);
    expect(planTestsForJob(types, ["old"]).map((t) => t.id)).toEqual(["cf"]);
  });
  it("allows a test only after the earlier ones are submitted and not failed", () => {
    const t = [
      { status: "SUBMITTED" as const, passed: true },
      { status: "NOT_STARTED" as const, passed: null },
      { status: "NOT_STARTED" as const, passed: null },
    ];
    expect(canStartTest(t, 1)).toBe(true);
    expect(canStartTest(t, 2)).toBe(false);
    expect(canStartTest(t, 0)).toBe(false);
    expect(canStartTest([{ status: "SUBMITTED", passed: false }, t[1]], 1)).toBe(false);
  });
});

describe("clock", () => {
  it("never goes below zero and formats mm:ss", () => {
    const deadline = new Date("2026-10-19T03:10:00Z");
    expect(secondsLeft(deadline, NOW)).toBe(600);
    expect(secondsLeft(deadline, new Date("2026-10-19T03:11:00Z"))).toBe(0);
    expect(formatClock(605)).toBe("10:05");
  });
  it("gives a few seconds of grace before a test counts as expired", () => {
    const deadline = new Date("2026-10-19T03:00:00Z");
    expect(isExpired(deadline, new Date("2026-10-19T03:00:03Z"))).toBe(false);
    expect(isExpired(deadline, new Date("2026-10-19T03:00:06Z"))).toBe(true);
    expect(isExpired(null, NOW)).toBe(false);
  });
});

describe("message templates", () => {
  it("fills the known placeholders and leaves unknown text alone", () => {
    const out = fillTemplate("Yth. {nama}, {POSISI} pada {tanggal} {jam} di {lokasi} {lain}", {
      nama: "Rina",
      posisi: "Operator",
      tanggal: "Senin, 26 Oktober 2026",
      jam: "09.00",
      lokasi: "Ruang HR",
    });
    expect(out).toBe("Yth. Rina, Operator pada Senin, 26 Oktober 2026 09.00 di Ruang HR {lain}");
  });
});

describe("what HR Admin does next", () => {
  const base: CandidateProgress = {
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
  };
  it("asks for a reviewer only while an essay has none", () => {
    expect(candidateNextStep({ ...base, status: "AWAITING_REVIEW" }).needsAction).toBe(true);
    expect(candidateNextStep({ ...base, status: "AWAITING_REVIEW", hasReviewer: true }).needsAction).toBe(false);
  });
  it("walks through the interview", () => {
    expect(candidateNextStep({ ...base, status: "TEST_PASSED" }).label).toBe("Undang interview");
    expect(candidateNextStep({ ...base, status: "INTERVIEWING" }).label).toBe("Jadwalkan interview");
    const mid = candidateNextStep({ ...base, status: "INTERVIEWING", hasInterview: true, interviewersTotal: 3, interviewersSubmitted: 2 });
    expect(mid).toEqual({ label: "Menunggu penilaian (2 dari 3)", needsAction: false });
    expect(candidateNextStep({ ...base, status: "INTERVIEWING", hasInterview: true, interviewersTotal: 3, interviewersSubmitted: 3 }).label).toBe("Tetapkan hasil akhir");
  });
  it("walks through the offer", () => {
    expect(candidateNextStep({ ...base, status: "OFFERING" }).label).toBe("Unggah offering letter");
    expect(candidateNextStep({ ...base, status: "OFFERING", hasOffer: true }).label).toBe("Kirim offering ke kandidat");
    expect(candidateNextStep({ ...base, status: "OFFERING", hasOffer: true, offerSent: true }).needsAction).toBe(false);
    expect(candidateNextStep({ ...base, status: "OFFERING", hasOffer: true, offerSent: true, offerAccepted: true }).label).toBe("Buat karyawan dari kandidat");
  });
  it("walks through an internal move", () => {
    expect(candidateNextStep({ ...base, status: "MOVEMENT" }).label).toBe("Buat Perubahan Posisi");
    expect(candidateNextStep({ ...base, status: "MOVEMENT", hasMovement: true, movementOpen: true }).needsAction).toBe(false);
    expect(candidateNextStep({ ...base, status: "MOVEMENT", hasMovement: true, movementOpen: false }).needsAction).toBe(true);
  });
  it("needs nothing once finished", () => {
    expect(candidateNextStep({ ...base, status: "REJECTED" }).needsAction).toBe(false);
  });
});

describe("interview results", () => {
  it("averages and counts", () => {
    expect(averageScore([5, 4, 4, 4, 4])).toBe(4.2);
    expect(averageScore([])).toBeNull();
    expect(countDecisions(["ACCEPTED", "ACCEPTED", "CONSIDERED", null])).toEqual({ ACCEPTED: 2, CONSIDERED: 1, REJECTED: 0 });
  });
});

describe("uploads", () => {
  it("accepts a normal CV and refuses wrong or oversized ones", () => {
    expect(validateCvFile({ name: "cv.pdf", size: 1000, type: "application/pdf" })).toBeNull();
    expect(validateCvFile({ name: "foto.JPG", size: 1000, type: "image/jpeg" })).toBeNull();
    expect(validateCvFile({ name: "cv.exe", size: 1000, type: "application/octet-stream" })).not.toBeNull();
    expect(validateCvFile({ name: "cv.pdf", size: 5 * 1024 * 1024, type: "application/pdf" })).not.toBeNull();
    expect(validateCvFile({ name: "cv.pdf", size: 2 * 1024 * 1024, type: "application/pdf" })).toBeNull();
    expect(validateCvFile({ name: "cv.pdf", size: 2 * 1024 * 1024 + 1, type: "application/pdf" })).toMatch(/2 MB/);
    expect(validateCvFile({ name: "cv.pdf", size: 0, type: "application/pdf" })).not.toBeNull();
    expect(validateCvFile({ name: "cv.pdf", size: 1000, type: "image/png" })).not.toBeNull();
  });
  it("accepts only a PDF for the offering letter", () => {
    expect(validateOfferFile({ name: "offer.pdf", size: 1000, type: "application/pdf" })).toBeNull();
    expect(validateOfferFile({ name: "offer.docx", size: 1000, type: "application/pdf" })).not.toBeNull();
  });
  it("accepts a drawn signature but not arbitrary text", () => {
    expect(isValidSignatureDataUrl(`data:image/png;base64,${"A".repeat(500)}`)).toBe(true);
    expect(isValidSignatureDataUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isValidSignatureDataUrl("<script>alert(1)</script>")).toBe(false);
  });
});

describe("pasting questions in bulk", () => {
  it("takes one scale or essay question per non-empty line", () => {
    const res = parseBulkQuestions("SCALE", "Saya suka bekerja dalam tim.\n\n  Saya cepat belajar.  \n");
    expect(res.errors).toEqual([]);
    expect(res.questions.map((q) => q.prompt)).toEqual(["Saya suka bekerja dalam tim.", "Saya cepat belajar."]);
  });

  it("reads multiple choice as question | options | correct number", () => {
    const res = parseBulkQuestions("MULTIPLE_CHOICE", "Berapa 2 + 3? | 4; 5; 6 | 2\nIbu kota Indonesia? | Bandung; Jakarta | 2");
    expect(res.errors).toEqual([]);
    expect(res.questions[0]).toEqual({ prompt: "Berapa 2 + 3?", options: ["4", "5", "6"], correctIndex: 1 });
    expect(res.questions[1].correctIndex).toBe(1);
  });

  it("names the line of every mistake and keeps the good ones", () => {
    const res = parseBulkQuestions("MULTIPLE_CHOICE", "Tanpa pemisah\nSoal | cuma satu | 1\nSoal | a; b | 3\nBaik | a; b | 1");
    expect(res.errors).toHaveLength(3);
    expect(res.errors[0]).toContain("Baris 1");
    expect(res.errors[2]).toContain("Baris 3");
    expect(res.questions).toHaveLength(1);
  });

  it("refuses a huge paste", () => {
    const res = parseBulkQuestions("SCALE", Array.from({ length: 300 }, (_, i) => `Soal ${i}`).join("\n"));
    expect(res.errors).toHaveLength(1);
    expect(res.questions).toHaveLength(0);
  });
});

describe("alternative sets of one test (Ketelitian Set A / Set B)", () => {
  const types = [
    { id: "cf", isGate: true, sortOrder: 1, active: true, variantGroup: null, name: "Cultural Fit", timeLimitMinutes: 10 },
    { id: "ka", isGate: false, sortOrder: 2, active: true, variantGroup: "Ketelitian", name: "Ketelitian Set A", timeLimitMinutes: 15 },
    { id: "kb", isGate: false, sortOrder: 2, active: true, variantGroup: "Ketelitian", name: "Ketelitian Set B", timeLimitMinutes: 15 },
    { id: "ld", isGate: false, sortOrder: 3, active: true, variantGroup: null, name: "Logika Dasar", timeLimitMinutes: 30 },
  ];

  it("gives an applicant only one of the alternatives", () => {
    const plan = planTestsForJob(types, ["ka", "kb", "ld"]);
    expect(plan.map((t) => t.id).filter((id) => id === "ka" || id === "kb")).toHaveLength(1);
    expect(plan.map((t) => t.id)).toContain("cf");
    expect(plan.map((t) => t.id)).toContain("ld");
  });

  it("hands out the set used least so far", () => {
    expect(planTestsForJob(types, ["ka", "kb"], { usage: new Map([["ka", 5], ["kb", 2]]) }).map((t) => t.id)).toEqual(["cf", "kb"]);
    expect(planTestsForJob(types, ["ka", "kb"], { usage: new Map([["ka", 1], ["kb", 4]]) }).map((t) => t.id)).toEqual(["cf", "ka"]);
  });

  it("flips a coin only between equals", () => {
    expect(planTestsForJob(types, ["ka", "kb"], { random: () => 0 }).map((t) => t.id)).toEqual(["cf", "ka"]);
    expect(planTestsForJob(types, ["ka", "kb"], { random: () => 0.99 }).map((t) => t.id)).toEqual(["cf", "kb"]);
  });

  it("keeps working when only one alternative is mapped or active", () => {
    expect(planTestsForJob(types, ["kb"]).map((t) => t.id)).toEqual(["cf", "kb"]);
    const oneOff = types.map((t) => (t.id === "ka" ? { ...t, active: false } : t));
    expect(planTestsForJob(oneOff, ["ka", "kb"]).map((t) => t.id)).toEqual(["cf", "kb"]);
  });

  it("lists every alternative when checking that each has questions", () => {
    expect(possibleTestsForJob(types, ["ka", "kb", "ld"]).map((t) => t.id)).toEqual(["cf", "ka", "kb", "ld"]);
    expect(pickVariants(possibleTestsForJob(types, ["ka", "kb"]), new Map(), () => 0)).toHaveLength(2);
  });

  it("shows applicants the group name and one step for the group", () => {
    expect(testDisplayName(types[1])).toBe("Ketelitian");
    expect(testDisplayName(types[3])).toBe("Logika Dasar");
    const steps = describeTestSteps(possibleTestsForJob(types, ["ka", "kb", "ld"]));
    expect(steps).toEqual([
      { label: "Cultural Fit", timeLimitMinutes: 10 },
      { label: "Ketelitian", timeLimitMinutes: 15 },
      { label: "Logika Dasar", timeLimitMinutes: 30 },
    ]);
  });
});

describe("istimewa", () => {
  it("marks a score at or above the threshold only", () => {
    expect(isExcellent(90, 90)).toBe(true);
    expect(isExcellent(93.3, 90)).toBe(true);
    expect(isExcellent(89.9, 90)).toBe(false);
    expect(isExcellent(100, null)).toBe(false);
    expect(isExcellent(null, 90)).toBe(false);
  });
});

describe("shuffled answer options", () => {
  const options = ["A", "B", "C", "D", "E"];

  it("leaves the order alone when shuffling is off", () => {
    expect(optionDisplayOrder(options, "any", false)).toEqual([0, 1, 2, 3, 4]);
  });

  it("is a permutation and gives the same order for the same seed", () => {
    const order = optionDisplayOrder(options, "test1:q1", true);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(optionDisplayOrder(options, "test1:q1", true)).toEqual(order);
  });

  it("differs between applicants and spreads the correct position around", () => {
    const orders = new Set<string>();
    const positions = [0, 0, 0, 0, 0];
    for (let i = 0; i < 500; i++) {
      const order = optionDisplayOrder(options, "applicant-" + i + ":q", true);
      orders.add(order.join(""));
      positions[order.indexOf(2)]++; // where the originally-third option (the key) ends up
    }
    expect(orders.size).toBeGreaterThan(50);
    for (const p of positions) expect(p).toBeGreaterThan(50); // each of A..E gets a fair share (expected 100)
  });

  it("keeps 'Semua benar' style options at the end", () => {
    const opts = ["Mesin A", "Mesin B", "Mesin C", "Tidak bisa ditentukan", "Semua benar"];
    for (let i = 0; i < 100; i++) {
      const order = optionDisplayOrder(opts, "s" + i, true);
      expect(order.slice(3)).toEqual([3, 4]);
      expect(order.slice(0, 3).sort()).toEqual([0, 1, 2]);
    }
    expect(isAnchoredOption("Semua jawaban benar")).toBe(true);
    expect(isAnchoredOption("Tidak ada yang benar")).toBe(true);
    expect(isAnchoredOption("Mesin B")).toBe(false);
    expect(isAnchoredOption("Tidak berhubungan sama sekali")).toBe(false);
  });
});

describe("tests chosen per vacancy", () => {
  it("uses the job title's tests until the vacancy has its own pick", () => {
    expect(testIdsForRequest({ testsCustomized: false, testTypeIds: ["x"] }, ["ka", "kb"])).toEqual(["ka", "kb"]);
    expect(testIdsForRequest({ testsCustomized: true, testTypeIds: ["ld"] }, ["ka", "kb"])).toEqual(["ld"]);
  });

  it("a customised vacancy with no extra tests only has the gate", () => {
    const types = [
      { id: "cf", isGate: true, sortOrder: 1, active: true },
      { id: "ld", isGate: false, sortOrder: 5, active: true },
    ];
    const ids = testIdsForRequest({ testsCustomized: true, testTypeIds: [] }, ["ld"]);
    expect(possibleTestsForJob(types, ids).map((t) => t.id)).toEqual(["cf"]);
  });

  it("puts alternative sets in one column", () => {
    const cols = groupTestColumns([
      { id: "ka", name: "Ketelitian Set A", variantGroup: "Ketelitian" },
      { id: "kb", name: "Ketelitian Set B", variantGroup: "Ketelitian" },
      { id: "ld", name: "Logika Dasar", variantGroup: null },
    ]);
    expect(cols).toEqual([
      { key: "Ketelitian", label: "Ketelitian", ids: ["ka", "kb"] },
      { key: "ld", label: "Logika Dasar", ids: ["ld"] },
    ]);
  });
});

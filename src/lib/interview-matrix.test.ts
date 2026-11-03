import { describe, expect, it } from "vitest";
import { canScheduleHr, canSubmitHr, checkMatrixScores, formatAverage, hrFormProblem, hrRejectCloseReason, hrRejectEmail, matrixAverage, scoreText, SCORE_LABEL, SCORE_STEPS, type HrState, type MatrixAspect } from "./interview-matrix";

const aspects: MatrixAspect[] = [
  { id: "a", label: "Pengalaman & Pengetahuan", optional: false },
  { id: "b", label: "Keterampilan Teknis", optional: false },
  { id: "c", label: "Tes Lapangan", optional: true },
];

describe("scale", () => {
  it("has five steps with a name each", () => {
    expect([...SCORE_STEPS]).toEqual([2, 4, 6, 8, 10]);
    expect(SCORE_LABEL).toEqual({ 2: "Sangat kurang", 4: "Kurang", 6: "Cukup", 8: "Baik", 10: "Sangat baik" });
  });
});

describe("checkMatrixScores", () => {
  it("accepts the required aspects and leaves the optional one out", () => {
    const r = checkMatrixScores(aspects, { a: 8, b: 6 });
    expect(r).toEqual({ ok: true, scores: [{ aspectId: "a", label: "Pengalaman & Pengetahuan", score: 8 }, { aspectId: "b", label: "Keterampilan Teknis", score: 6 }] });
  });
  it("keeps the optional aspect when it was scored", () => {
    const r = checkMatrixScores(aspects, { a: 10, b: 2, c: 4 });
    expect(r.ok && r.scores.map((s) => s.aspectId)).toEqual(["a", "b", "c"]);
  });
  it("asks for a missing required aspect by name", () => {
    expect(checkMatrixScores(aspects, { a: 8 })).toEqual({ ok: false, error: 'Beri nilai untuk "Keterampilan Teknis".' });
    expect(checkMatrixScores(aspects, { a: 8, b: Number.NaN })).toEqual({ ok: false, error: 'Beri nilai untuk "Keterampilan Teknis".' });
  });
  it.each([1, 3, 5, 7, 9, 0, 11, 6.5, -2])("refuses %s", (bad) => {
    const r = checkMatrixScores(aspects, { a: bad, b: 6 });
    expect(r.ok).toBe(false);
  });
  it("refuses a bad value on the optional aspect too", () => {
    expect(checkMatrixScores(aspects, { a: 8, b: 6, c: 5 }).ok).toBe(false);
  });
});

describe("average and text", () => {
  it("rounds to one decimal and ignores nothing scored", () => {
    expect(matrixAverage([8, 6, 10, 8, 8, 6])).toBe(7.7);
    expect(matrixAverage([8, 8, 6])).toBe(7.3);
    expect(matrixAverage([])).toBeNull();
  });
  it("writes the average with a decimal comma", () => {
    expect(formatAverage(7.3)).toBe("7,3");
    expect(formatAverage(8)).toBe("8");
    expect(formatAverage(null)).toBe("—");
  });
  it("shows old 1-5 scores with their scale", () => {
    expect(scoreText(8, 10)).toBe("8");
    expect(scoreText(4, 5)).toBe("4 dari 5");
    expect(scoreText(null, 10)).toBe("—");
  });
});

describe("HR round", () => {
  const base: HrState = { candidateStatus: "INTERVIEWING", interviewDecision: null, hasHrInterview: true, hrCancelled: false, hrSubmitted: false };
  it("can be scheduled from the test result until the form is sent", () => {
    expect(canScheduleHr({ ...base, candidateStatus: "TEST_PASSED", hasHrInterview: false } as HrState)).toBe(true);
    expect(canScheduleHr(base)).toBe(true);
    expect(canScheduleHr({ ...base, hrSubmitted: true })).toBe(false);
    expect(canScheduleHr({ ...base, hrCancelled: true })).toBe(false);
    expect(canScheduleHr({ ...base, candidateStatus: "REJECTED" })).toBe(false);
    expect(canScheduleHr({ ...base, interviewDecision: "ACCEPTED" })).toBe(false);
  });
  it("the form can be sent once, while the applicant is in the interview stage", () => {
    expect(canSubmitHr(base)).toBe(true);
    expect(canSubmitHr({ ...base, hasHrInterview: false })).toBe(false);
    expect(canSubmitHr({ ...base, hrSubmitted: true })).toBe(false);
    expect(canSubmitHr({ ...base, hrCancelled: true })).toBe(false);
    expect(canSubmitHr({ ...base, candidateStatus: "WITHDRAWN" })).toBe(false);
    expect(canSubmitHr({ ...base, candidateStatus: "TEST_PASSED" })).toBe(false);
  });
  it("needs a recommendation, and a note when turning the applicant down", () => {
    expect(hrFormProblem({ recommendation: "", note: "" })).toContain("rekomendasi");
    expect(hrFormProblem({ recommendation: "MAYBE", note: "x" })).toContain("rekomendasi");
    expect(hrFormProblem({ recommendation: "ACCEPTED", note: "" })).toBeNull();
    expect(hrFormProblem({ recommendation: "CONSIDERED", note: "" })).toBeNull();
    expect(hrFormProblem({ recommendation: "REJECTED", note: "  " })).toContain("Catatan");
    expect(hrFormProblem({ recommendation: "REJECTED", note: "Energi rendah" })).toBeNull();
  });
  it("writes the close reason and the e-mail", () => {
    expect(hrRejectCloseReason(" Energi rendah ")).toBe("Ditolak pada interview HR: Energi rendah");
    const m = hrRejectEmail({ candidateName: "Dewi", positionTitle: "Operator", tanggal: "Kamis, 12 November 2026", jam: "10.00 WIB" });
    expect(m.subject).toBe("Interview dibatalkan (SAPA)");
    expect(m.text).toContain("Dewi");
    expect(m.text).toContain("tidak lolos interview HR");
    expect(m.text).toContain("tidak perlu mengisi penilaian");
  });
});

import { describe, expect, it } from "vitest";
import {
  canHoldStatus,
  describeEvent,
  fallbackSeatSpec,
  headcountFloor,
  jobChangeNeedsReason,
  jobChangeProblem,
  nextCode,
  reduceHeadcountProblem,
  statusAfterReduce,
} from "./recruitment-request-changes";

describe("hold", () => {
  it("only an approved, still open request can be held", () => {
    for (const s of ["APPROVED", "RECRUITMENT_IN_PROGRESS", "PARTIALLY_FILLED"] as const) expect(canHoldStatus(s)).toBe(true);
    for (const s of ["DRAFT", "PENDING_DEPT_HEAD", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "RETURNED", "FILLED", "CLOSED", "CANCELLED"] as const) expect(canHoldStatus(s)).toBe(false);
  });
});

describe("reduceHeadcountProblem", () => {
  const base = { status: "RECRUITMENT_IN_PROGRESS" as const, current: 3, next: 2, filled: 1, mutationsUnderway: 0 };
  it("allows a reduction down to the floor", () => {
    expect(reduceHeadcountProblem(base)).toBeNull();
    expect(reduceHeadcountProblem({ ...base, next: 1 })).toBeNull();
    expect(reduceHeadcountProblem({ ...base, filled: 0, next: 1 })).toBeNull();
  });
  it("floor counts placed people plus running Mutasi, at least 1", () => {
    expect(headcountFloor(1, 1)).toBe(2);
    expect(headcountFloor(0, 0)).toBe(1);
    expect(reduceHeadcountProblem({ ...base, next: 1, mutationsUnderway: 1 })).toMatch(/kurang dari 2/);
    expect(reduceHeadcountProblem({ ...base, next: 0, filled: 0 })).toMatch(/kurang dari 1/);
  });
  it("never adds people or repeats the same number", () => {
    expect(reduceHeadcountProblem({ ...base, next: 4 })).toMatch(/permintaan baru/);
    expect(reduceHeadcountProblem({ ...base, next: 3 })).toMatch(/sama/);
    expect(reduceHeadcountProblem({ ...base, next: 1.5 })).toMatch(/bulat/);
  });
  it("only after approval and before it is filled", () => {
    expect(reduceHeadcountProblem({ ...base, status: "SUBMITTED" })).not.toBeNull();
    expect(reduceHeadcountProblem({ ...base, status: "FILLED" })).not.toBeNull();
  });
});

describe("statusAfterReduce", () => {
  it("becomes Terisi when the new number is already placed", () => {
    expect(statusAfterReduce("PARTIALLY_FILLED", 1, 1)).toBe("FILLED");
    expect(statusAfterReduce("PARTIALLY_FILLED", 2, 2)).toBe("FILLED");
  });
  it("keeps its status otherwise", () => {
    expect(statusAfterReduce("PARTIALLY_FILLED", 2, 1)).toBe("PARTIALLY_FILLED");
    expect(statusAfterReduce("APPROVED", 1, 0)).toBe("APPROVED");
  });
});

describe("jobChangeProblem", () => {
  it("is blocked once someone is placed or a Mutasi is running", () => {
    expect(jobChangeProblem({ filled: 0, mutationsUnderway: 0, internalMovesUnderway: 0 })).toBeNull();
    expect(jobChangeProblem({ filled: 1, mutationsUnderway: 0, internalMovesUnderway: 0 })).toMatch(/ditempatkan/);
    expect(jobChangeProblem({ filled: 0, mutationsUnderway: 1, internalMovesUnderway: 0 })).toMatch(/Mutasi/);
    expect(jobChangeProblem({ filled: 0, mutationsUnderway: 0, internalMovesUnderway: 1 })).toMatch(/Mutasi/);
  });
  it("needs a reason only after approval", () => {
    expect(jobChangeNeedsReason("SUBMITTED")).toBe(false);
    expect(jobChangeNeedsReason("APPROVED")).toBe(true);
  });
});

describe("nextCode / fallbackSeatSpec / describeEvent", () => {
  it("continues the numbering", () => {
    expect(nextCode("JOB-", ["JOB-001", "JOB-053", "X-9"])).toBe("JOB-054");
    expect(nextCode("JOB-", [])).toBe("JOB-001");
    expect(nextCode("JOB-054-", ["JOB-054-001"])).toBe("JOB-054-002");
  });
  it("seat defaults follow the level", () => {
    expect(fallbackSeatSpec("SUPERVISOR")).toEqual({ jobLevel: "2A", positionType: "TEAM_LEAD" });
    expect(fallbackSeatSpec(null).positionType).toBe("STAFF");
  });
  it("describes events in plain words", () => {
    expect(describeEvent({ kind: "HEADCOUNT_REDUCED", fromValue: "3", toValue: "2", note: "turun" })).toBe('mengurangi jumlah 3 menjadi 2: "turun"');
    expect(describeEvent({ kind: "RESUMED", fromValue: null, toValue: null, note: null })).toBe("melanjutkan permintaan");
  });
});

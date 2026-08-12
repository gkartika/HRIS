import { describe, it, expect } from "vitest";
import { pickSingleEvaluator, isLevel3JobLevel } from "./competency-routing";

describe("pickSingleEvaluator", () => {
  it("returns null for no candidates", () => {
    expect(pickSingleEvaluator([])).toBeNull();
  });

  it("prefers a PRIMARY-type holder over Acting/Additional/Temporary", () => {
    const result = pickSingleEvaluator([
      { employeeId: "e-acting", positionId: "p1", assignmentType: "ACTING" },
      { employeeId: "e-primary", positionId: "p1", assignmentType: "PRIMARY" },
    ]);
    expect(result?.employeeId).toBe("e-primary");
  });

  it("falls back to a deterministic (lowest employeeId) pick when no PRIMARY holder exists", () => {
    const result = pickSingleEvaluator([
      { employeeId: "e-zzz", positionId: "p1", assignmentType: "ACTING" },
      { employeeId: "e-aaa", positionId: "p1", assignmentType: "TEMPORARY" },
    ]);
    expect(result?.employeeId).toBe("e-aaa");
  });

  it("is stable across re-runs regardless of input order", () => {
    const candidates = [
      { employeeId: "e-b", positionId: "p1", assignmentType: "ACTING" },
      { employeeId: "e-a", positionId: "p1", assignmentType: "ACTING" },
    ];
    const first = pickSingleEvaluator(candidates);
    const second = pickSingleEvaluator([...candidates].reverse());
    expect(first).toEqual(second);
  });
});

describe("isLevel3JobLevel (COM-15)", () => {
  it("3A and 3B are Level 3", () => {
    expect(isLevel3JobLevel("3A")).toBe(true);
    expect(isLevel3JobLevel("3B")).toBe(true);
  });

  it("other levels are not", () => {
    expect(isLevel3JobLevel("1A")).toBe(false);
    expect(isLevel3JobLevel("2B")).toBe(false);
  });
});

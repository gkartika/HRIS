import { describe, expect, it } from "vitest";
import { readinessProblems, type PlanContext } from "./recruitment-service";

// A request that is held takes no applicants, whatever else is ready.
const ctx = { types: [{ id: "gate", isGate: true, active: true, activeQuestions: 5, name: "Cultural Fit" }], jobTestIds: new Map() } as unknown as PlanContext;
const request = {
  jobId: "job-1",
  status: "RECRUITMENT_IN_PROGRESS" as const,
  accessCode: "ABC",
  requestedHeadcount: 2,
  openFor: "EXTERNAL" as const,
  testsCustomized: false,
  testTypeIds: [] as string[],
};

describe("readinessProblems and hold", () => {
  it("is ready when not held", () => {
    expect(readinessProblems(ctx, { ...request, heldAt: null }, 0)).toEqual([]);
  });

  it("reports the hold as a problem and nothing else changes", () => {
    expect(readinessProblems(ctx, { ...request, heldAt: new Date() }, 0)).toEqual(["Permintaan sedang ditahan."]);
  });
});

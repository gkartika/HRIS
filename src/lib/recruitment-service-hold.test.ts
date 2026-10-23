import { describe, expect, it } from "vitest";
import { readinessProblems, type PlanContext } from "./recruitment-service";
import { ASSESSMENT_NOT_ACTIVE_PROBLEM } from "./recruitment-candidates";

// A request that is held takes no applicants, whatever else is ready.
const ctx = { types: [], jobTestIds: new Map(), assessment: { timeLimitMinutes: 30, questionCount: 20 } } as unknown as PlanContext;
const request = {
  jobId: "job-1",
  status: "RECRUITMENT_IN_PROGRESS" as const,
  accessCode: "ABC",
  requestedHeadcount: 2,
  openFor: "EXTERNAL" as const,
  testsCustomized: false,
  testTypeIds: [] as string[],
  publicDescription: "Tentang pekerjaan",
};

describe("readinessProblems and hold", () => {
  it("is ready when not held", () => {
    expect(readinessProblems(ctx, { ...request, heldAt: null }, 0)).toEqual([]);
  });

  it("a vacancy without its written detail is not ready", () => {
    expect(readinessProblems(ctx, { ...request, heldAt: null, publicDescription: null }, 0)).toEqual(["Detail lowongan belum ditulis."]);
    expect(readinessProblems(ctx, { ...request, heldAt: null, publicDescription: "   " }, 0)).toEqual(["Detail lowongan belum ditulis."]);
  });

  it("a vacancy cannot take applicants while Tes Situasi Kerja has no active rubric", () => {
    const noRubric = { ...ctx, assessment: null } as unknown as PlanContext;
    expect(readinessProblems(noRubric, { ...request, heldAt: null }, 0)).toEqual([ASSESSMENT_NOT_ACTIVE_PROBLEM]);
  });

  it("reports the hold as a problem and nothing else changes", () => {
    expect(readinessProblems(ctx, { ...request, heldAt: new Date() }, 0)).toEqual(["Permintaan sedang ditahan."]);
  });
});

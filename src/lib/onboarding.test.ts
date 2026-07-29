import { describe, it, expect } from "vitest";
import { formatOnboardingCaseNumber, computeOnboardingStatus, isOnboardingFullyComplete } from "./onboarding";

describe("formatOnboardingCaseNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(formatOnboardingCaseNumber(1, 2026)).toBe("ONB-2026-0001");
    expect(formatOnboardingCaseNumber(42, 2026)).toBe("ONB-2026-0042");
  });
});

describe("computeOnboardingStatus (LIF-03)", () => {
  const base = {
    contractComplete: false,
    mandatoryMaterialComplete: false,
    assetsComplete: false,
    plannedStartDate: new Date("2026-08-10"),
    mandatoryMaterialDueDate: new Date("2026-08-24") as Date | null,
  };

  it("is Complete once all three flags are true, regardless of dates", () => {
    const now = new Date("2026-08-01");
    expect(
      computeOnboardingStatus(
        { ...base, contractComplete: true, mandatoryMaterialComplete: true, assetsComplete: true },
        now
      )
    ).toBe("COMPLETE");
  });

  it("is Not Started before the planned start date with nothing done", () => {
    const now = new Date("2026-08-05");
    expect(computeOnboardingStatus(base, now)).toBe("NOT_STARTED");
  });

  it("is In Progress on/after the start date with partial completion", () => {
    const now = new Date("2026-08-11");
    expect(computeOnboardingStatus({ ...base, contractComplete: true }, now)).toBe("IN_PROGRESS");
  });

  it("is Overdue once the mandatory-material due date passes without that flag set", () => {
    const now = new Date("2026-08-25");
    expect(computeOnboardingStatus({ ...base, contractComplete: true }, now)).toBe("OVERDUE");
  });

  it("is not Overdue if mandatory material was completed before its due date", () => {
    const now = new Date("2026-08-25");
    expect(computeOnboardingStatus({ ...base, mandatoryMaterialComplete: true }, now)).toBe("IN_PROGRESS");
  });

  it("handles no due date set (never Overdue on that basis)", () => {
    const now = new Date("2026-09-01");
    expect(computeOnboardingStatus({ ...base, mandatoryMaterialDueDate: null, contractComplete: true }, now)).toBe(
      "IN_PROGRESS"
    );
  });
});

describe("isOnboardingFullyComplete", () => {
  it("requires all three flags", () => {
    expect(isOnboardingFullyComplete(true, true, true)).toBe(true);
    expect(isOnboardingFullyComplete(true, true, false)).toBe(false);
    expect(isOnboardingFullyComplete(false, false, false)).toBe(false);
  });
});

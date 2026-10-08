import { describe, it, expect } from "vitest";
import {
  formatOnboardingCaseNumber,
  computeOnboardingStatus,
  isOnboardingFullyComplete,
  isOnboardingTrainingComplete,
  isOnboardingAssetsComplete,
  onboardingTrainingNote,
  canCancelOnboardingCase,
  canReopenOnboardingCase,
  shouldApplyOnboardingTrainingOnPlacement,
} from "./onboarding";

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

describe("isOnboardingTrainingComplete", () => {
  it("is trivially complete when no onboarding-required course applies", () => {
    expect(isOnboardingTrainingComplete([])).toBe(true);
  });

  it("requires every non-cancelled assignment to be COMPLETED", () => {
    expect(isOnboardingTrainingComplete(["COMPLETED", "COMPLETED"])).toBe(true);
    expect(isOnboardingTrainingComplete(["COMPLETED", "ASSIGNED"])).toBe(false);
    expect(isOnboardingTrainingComplete(["ASSIGNED"])).toBe(false);
  });

  it("ignores CANCELLED assignments — they're not a real obligation anymore", () => {
    expect(isOnboardingTrainingComplete(["COMPLETED", "CANCELLED"])).toBe(true);
    expect(isOnboardingTrainingComplete(["CANCELLED"])).toBe(true);
  });
});

describe("isOnboardingAssetsComplete", () => {
  it("is trivially complete when no asset is assigned", () => {
    expect(isOnboardingAssetsComplete([])).toBe(true);
  });

  it("is complete once every open custody is ACTIVE", () => {
    expect(isOnboardingAssetsComplete(["ACTIVE", "ACTIVE"])).toBe(true);
  });

  // Custody has no intermediate "awaiting acknowledgement" status in this
  // app (removed per direct user request — see lib/assets.ts), but the
  // predicate itself still correctly blocks on any non-ACTIVE, non-RETURNED
  // status, in case one is ever reintroduced.
  it("blocks on any status that isn't ACTIVE or RETURNED", () => {
    expect(isOnboardingAssetsComplete(["ACTIVE", "SOME_FUTURE_STATUS"])).toBe(false);
  });

  it("ignores RETURNED custodies — they're closed history, not a blocker", () => {
    expect(isOnboardingAssetsComplete(["ACTIVE", "RETURNED"])).toBe(true);
    expect(isOnboardingAssetsComplete(["RETURNED"])).toBe(true);
  });
});

describe("onboarding decided 2026-10-08", () => {
  it("is not complete for an employee with no placement and nothing assigned", () => {
    expect(isOnboardingTrainingComplete([], false)).toBe(false);
  });
  it("is complete for a placed employee with nothing assigned", () => {
    expect(isOnboardingTrainingComplete([], true)).toBe(true);
    expect(isOnboardingTrainingComplete([])).toBe(true);
  });
  it("still follows the assignments once there are some", () => {
    expect(isOnboardingTrainingComplete(["COMPLETED"], false)).toBe(true);
    expect(isOnboardingTrainingComplete(["ASSIGNED"], true)).toBe(false);
  });
  it("explains an empty list instead of showing a bare tick", () => {
    expect(onboardingTrainingNote([], false)).toBe("WAITING_FOR_PLACEMENT");
    expect(onboardingTrainingNote(["CANCELLED"], true)).toBe("NONE_FOR_POSITION");
    expect(onboardingTrainingNote(["ASSIGNED"], true)).toBeNull();
  });
  it("a cancelled case reports CANCELLED whatever else is true", () => {
    expect(
      computeOnboardingStatus({
        contractComplete: true,
        mandatoryMaterialComplete: true,
        assetsComplete: true,
        plannedStartDate: new Date("2026-01-01"),
        mandatoryMaterialDueDate: null,
        cancelledAt: new Date("2026-02-01"),
      })
    ).toBe("CANCELLED");
  });
  it("cancels only open cases and reopens only cancelled ones", () => {
    expect(canCancelOnboardingCase({ cancelledAt: null, completedAt: null })).toBe(true);
    expect(canCancelOnboardingCase({ cancelledAt: new Date(), completedAt: null })).toBe(false);
    expect(canCancelOnboardingCase({ cancelledAt: null, completedAt: new Date() })).toBe(false);
    expect(canReopenOnboardingCase({ cancelledAt: new Date() })).toBe(true);
    expect(canReopenOnboardingCase({ cancelledAt: null })).toBe(false);
  });
  it("assigns onboarding courses only on the first placement of someone with an open case", () => {
    expect(shouldApplyOnboardingTrainingOnPlacement({ hadPrimaryPlacementBefore: false, hasOpenOnboardingCase: true })).toBe(true);
    expect(shouldApplyOnboardingTrainingOnPlacement({ hadPrimaryPlacementBefore: true, hasOpenOnboardingCase: true })).toBe(false);
    expect(shouldApplyOnboardingTrainingOnPlacement({ hadPrimaryPlacementBefore: false, hasOpenOnboardingCase: false })).toBe(false);
  });
});

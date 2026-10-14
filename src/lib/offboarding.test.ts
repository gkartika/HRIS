import { describe, it, expect } from "vitest";
import {
  formatOffboardingCaseNumber,
  INITIAL_OFFBOARDING_CASE_STATUS,
  canExecuteExitClearanceStatus,
  canCancelOffboardingCaseStatus,
  isPastLastWorkingDay,
  parseExitReturnCondition,
} from "./offboarding";

describe("formatOffboardingCaseNumber", () => {
  it("formats like MOV-YYYY-NNNN but with the OFB prefix", () => {
    expect(formatOffboardingCaseNumber(6, 2026)).toBe("OFB-2026-0006");
  });
});

describe("INITIAL_OFFBOARDING_CASE_STATUS", () => {
  it("every case starts ready for exit clearance — HR Admin opens it, no approval stage", () => {
    expect(INITIAL_OFFBOARDING_CASE_STATUS).toBe("PENDING_CLEARANCE");
  });
});

describe("canExecuteExitClearanceStatus", () => {
  it("only PENDING_CLEARANCE can have exit clearance executed", () => {
    expect(canExecuteExitClearanceStatus("PENDING_CLEARANCE")).toBe(true);
    expect(canExecuteExitClearanceStatus("COMPLETED")).toBe(false);
    expect(canExecuteExitClearanceStatus("CANCELLED")).toBe(false);
  });
});

describe("canCancelOffboardingCaseStatus", () => {
  it("a case pending clearance can be cancelled", () => {
    expect(canCancelOffboardingCaseStatus("PENDING_CLEARANCE")).toBe(true);
  });

  it("a terminal state cannot be cancelled again", () => {
    expect(canCancelOffboardingCaseStatus("COMPLETED")).toBe(false);
    expect(canCancelOffboardingCaseStatus("CANCELLED")).toBe(false);
  });
});

describe("isPastLastWorkingDay", () => {
  const lwd = new Date("2026-10-20T00:00:00.000Z");
  it("keeps access through the whole last working day", () => {
    expect(isPastLastWorkingDay(lwd, new Date("2026-10-19T00:00:00.000Z"))).toBe(false);
    expect(isPastLastWorkingDay(lwd, new Date("2026-10-20T00:00:00.000Z"))).toBe(false);
  });
  it("ends access the day after", () => {
    expect(isPastLastWorkingDay(lwd, new Date("2026-10-21T00:00:00.000Z"))).toBe(true);
  });
});

describe("parseExitReturnCondition", () => {
  it("returns good and repairable assets to normal status without a disposal", () => {
    expect(parseExitReturnCondition("GOOD")).toMatchObject({ assetStatus: "AVAILABLE", disposalReason: null });
    expect(parseExitReturnCondition("NEEDS_REPAIR")).toMatchObject({ assetStatus: "UNDER_REPAIR", disposalReason: null });
  });
  it("sends a lost asset to loss review with a disposal proposal, never straight to disposed", () => {
    expect(parseExitReturnCondition("LOST")).toMatchObject({
      inspectionResult: "LOST_OR_BEYOND_REPAIR",
      disposalReason: "CONFIRMED_LOSS",
      assetStatus: "PENDING_DISPOSAL",
    });
  });
  it("sends a beyond-repair asset to a disposal proposal, never straight to disposed", () => {
    expect(parseExitReturnCondition("BEYOND_REPAIR")).toMatchObject({ disposalReason: "BEYOND_REPAIR", assetStatus: "PENDING_DISPOSAL" });
  });
  it("reads the old combined value as beyond repair", () => {
    expect(parseExitReturnCondition("LOST_OR_BEYOND_REPAIR")?.condition).toBe("BEYOND_REPAIR");
  });
  it("rejects anything else", () => {
    expect(parseExitReturnCondition("")).toBeNull();
    expect(parseExitReturnCondition("DISPOSED")).toBeNull();
    expect(parseExitReturnCondition(undefined)).toBeNull();
  });
});

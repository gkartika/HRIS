import { describe, it, expect } from "vitest";
import {
  formatOffboardingCaseNumber,
  initialOffboardingCaseStatus,
  canDecideOffboardingCaseStatus,
  canExecuteExitClearanceStatus,
  canCancelOffboardingCaseStatus,
} from "./offboarding";

describe("formatOffboardingCaseNumber", () => {
  it("formats like MOV-YYYY-NNNN but with the OFB prefix", () => {
    expect(formatOffboardingCaseNumber(6, 2026)).toBe("OFB-2026-0006");
  });
});

describe("initialOffboardingCaseStatus (LIF-06/12)", () => {
  it("a reported resignation starts awaiting HR Manager decision", () => {
    expect(initialOffboardingCaseStatus("RESIGNATION")).toBe("PENDING_HR_MANAGER");
  });

  it("a non-renewal handoff starts ready for exit clearance, skipping a second HR Manager decision", () => {
    expect(initialOffboardingCaseStatus("CONTRACT_NON_RENEWAL")).toBe("PENDING_CLEARANCE");
  });
});

describe("canDecideOffboardingCaseStatus", () => {
  it("only PENDING_HR_MANAGER can be decided", () => {
    expect(canDecideOffboardingCaseStatus("PENDING_HR_MANAGER")).toBe(true);
    expect(canDecideOffboardingCaseStatus("PENDING_CLEARANCE")).toBe(false);
    expect(canDecideOffboardingCaseStatus("COMPLETED")).toBe(false);
    expect(canDecideOffboardingCaseStatus("CANCELLED")).toBe(false);
  });
});

describe("canExecuteExitClearanceStatus", () => {
  it("only PENDING_CLEARANCE can have exit clearance executed", () => {
    expect(canExecuteExitClearanceStatus("PENDING_CLEARANCE")).toBe(true);
    expect(canExecuteExitClearanceStatus("PENDING_HR_MANAGER")).toBe(false);
    expect(canExecuteExitClearanceStatus("COMPLETED")).toBe(false);
    expect(canExecuteExitClearanceStatus("CANCELLED")).toBe(false);
  });
});

describe("canCancelOffboardingCaseStatus", () => {
  it("either pending stage can be cancelled", () => {
    expect(canCancelOffboardingCaseStatus("PENDING_HR_MANAGER")).toBe(true);
    expect(canCancelOffboardingCaseStatus("PENDING_CLEARANCE")).toBe(true);
  });

  it("a terminal state cannot be cancelled again", () => {
    expect(canCancelOffboardingCaseStatus("COMPLETED")).toBe(false);
    expect(canCancelOffboardingCaseStatus("CANCELLED")).toBe(false);
  });
});

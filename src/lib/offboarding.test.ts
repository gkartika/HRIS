import { describe, it, expect } from "vitest";
import {
  formatOffboardingCaseNumber,
  INITIAL_OFFBOARDING_CASE_STATUS,
  canExecuteExitClearanceStatus,
  canCancelOffboardingCaseStatus,
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

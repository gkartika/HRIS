import { describe, it, expect } from "vitest";
import {
  formatMovementRequestNumber,
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
  requiresProposedEmploymentStatus,
  validateProposedPosition,
} from "./movement";

describe("formatMovementRequestNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(formatMovementRequestNumber(1, 2026)).toBe("MOV-2026-0001");
    expect(formatMovementRequestNumber(42, 2026)).toBe("MOV-2026-0042");
  });
});

describe("canDecideMovementRequestStatus (LIF-04)", () => {
  it("only allows deciding a Submitted request", () => {
    expect(canDecideMovementRequestStatus("SUBMITTED")).toBe(true);
    expect(canDecideMovementRequestStatus("APPROVED")).toBe(false);
    expect(canDecideMovementRequestStatus("REJECTED")).toBe(false);
    expect(canDecideMovementRequestStatus("IMPLEMENTED")).toBe(false);
    expect(canDecideMovementRequestStatus("CANCELLED")).toBe(false);
  });
});

describe("canExecuteMovementRequestStatus (LIF-04)", () => {
  it("only allows executing an Approved request", () => {
    expect(canExecuteMovementRequestStatus("APPROVED")).toBe(true);
    expect(canExecuteMovementRequestStatus("SUBMITTED")).toBe(false);
    expect(canExecuteMovementRequestStatus("REJECTED")).toBe(false);
    expect(canExecuteMovementRequestStatus("IMPLEMENTED")).toBe(false);
    expect(canExecuteMovementRequestStatus("CANCELLED")).toBe(false);
  });
});

describe("canCancelMovementRequestStatus", () => {
  it("blocks Implemented, Cancelled, and Rejected", () => {
    expect(canCancelMovementRequestStatus("IMPLEMENTED")).toBe(false);
    expect(canCancelMovementRequestStatus("CANCELLED")).toBe(false);
    expect(canCancelMovementRequestStatus("REJECTED")).toBe(false);
  });

  it("allows Submitted and Approved", () => {
    expect(canCancelMovementRequestStatus("SUBMITTED")).toBe(true);
    expect(canCancelMovementRequestStatus("APPROVED")).toBe(true);
  });
});

describe("requiresProposedEmploymentStatus", () => {
  it("is true only for STATUS_CHANGE", () => {
    expect(requiresProposedEmploymentStatus("STATUS_CHANGE")).toBe(true);
    expect(requiresProposedEmploymentStatus("PROMOTION")).toBe(false);
    expect(requiresProposedEmploymentStatus("ROTATION")).toBe(false);
    expect(requiresProposedEmploymentStatus("MUTATION")).toBe(false);
    expect(requiresProposedEmploymentStatus("DEMOTION")).toBe(false);
  });
});

describe("validateProposedPosition", () => {
  it("requires STATUS_CHANGE to keep the same Position", () => {
    expect(validateProposedPosition("STATUS_CHANGE", "pos-1", "pos-1")).toBeNull();
    expect(validateProposedPosition("STATUS_CHANGE", "pos-1", "pos-2")).not.toBeNull();
  });

  it("requires every other type to propose a different Position", () => {
    expect(validateProposedPosition("PROMOTION", "pos-1", "pos-2")).toBeNull();
    expect(validateProposedPosition("PROMOTION", "pos-1", "pos-1")).not.toBeNull();
    expect(validateProposedPosition("ROTATION", "pos-1", "pos-1")).not.toBeNull();
    expect(validateProposedPosition("MUTATION", "pos-1", "pos-1")).not.toBeNull();
    expect(validateProposedPosition("DEMOTION", "pos-1", "pos-1")).not.toBeNull();
  });
});

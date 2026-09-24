import { describe, it, expect } from "vitest";
import {
  formatRenewalCaseNumber,
  isRenewalDue,
  canSubmitDeptHeadRecommendation,
  canDecideRenewalCase,
  requiresLinkedMovement,
  recommendationToMovementType,
  recommendationDurationMonths,
  requiresChangeReason,
} from "./contract-renewal";

describe("formatRenewalCaseNumber", () => {
  it("formats like MOV-YYYY-NNNN but with the REN prefix", () => {
    expect(formatRenewalCaseNumber(6, 2026)).toBe("REN-2026-0006");
  });
});

describe("isRenewalDue (LIF-08)", () => {
  it("is false with no end date", () => {
    expect(isRenewalDue(null, new Date("2026-08-03"))).toBe(false);
  });

  it("is false more than 30 days out", () => {
    expect(isRenewalDue(new Date("2026-10-01"), new Date("2026-08-03"))).toBe(false);
  });

  it("is true at exactly 30 days out, matching computeExpiryUrgency's DUE_30", () => {
    expect(isRenewalDue(new Date("2026-09-02"), new Date("2026-08-03"))).toBe(true);
  });

  it("is true for an already-past end date", () => {
    expect(isRenewalDue(new Date("2026-07-01"), new Date("2026-08-03"))).toBe(true);
  });
});

describe("case status guards", () => {
  it("dept head recommendation requires EVALUATION_SENT status (linked Evaluation completeness is checked separately via evaluation.ts)", () => {
    expect(canSubmitDeptHeadRecommendation("EVALUATION_SENT")).toBe(true);
    expect(canSubmitDeptHeadRecommendation("TRIGGERED")).toBe(false);
    expect(canSubmitDeptHeadRecommendation("PENDING_HR_MANAGER")).toBe(false);
  });

  it("HR Manager decision only from PENDING_HR_MANAGER", () => {
    expect(canDecideRenewalCase("PENDING_HR_MANAGER")).toBe(true);
    expect(canDecideRenewalCase("EVALUATION_SENT")).toBe(false);
  });
});

describe("recommendation helpers", () => {
  it("only Mutasi/Demosi require a linked Perubahan Posisi draft", () => {
    expect(requiresLinkedMovement("MUTASI")).toBe(true);
    expect(requiresLinkedMovement("DEMOSI")).toBe(true);
    expect(requiresLinkedMovement("PERPANJANG_3")).toBe(false);
    expect(requiresLinkedMovement("TIDAK_DIPERPANJANG")).toBe(false);
  });

  it("maps to the correct MovementType", () => {
    expect(recommendationToMovementType("MUTASI")).toBe("MUTATION");
    expect(recommendationToMovementType("DEMOSI")).toBe("DEMOTION");
    expect(recommendationToMovementType("PERPANJANG_3")).toBe(null);
  });

  it("resolves Perpanjang duration in months", () => {
    expect(recommendationDurationMonths("PERPANJANG_3")).toBe(3);
    expect(recommendationDurationMonths("PERPANJANG_6")).toBe(6);
    expect(recommendationDurationMonths("PERPANJANG_12")).toBe(12);
    expect(recommendationDurationMonths("MUTASI")).toBe(null);
  });

});

describe("requiresChangeReason (WF-12)", () => {
  it("false when Dept Head recommendation is null (nothing to differ from)", () => {
    expect(requiresChangeReason(null, "MUTASI")).toBe(false);
  });

  it("false when the HR Manager keeps the same recommendation", () => {
    expect(requiresChangeReason("MUTASI", "MUTASI")).toBe(false);
  });

  it("true when the HR Manager changes the recommendation", () => {
    expect(requiresChangeReason("MUTASI", "TIDAK_DIPERPANJANG")).toBe(true);
    expect(requiresChangeReason("PERPANJANG_3", "PERPANJANG_6")).toBe(true);
  });
});

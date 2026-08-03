import { describe, it, expect } from "vitest";
import {
  formatRenewalCaseNumber,
  isRenewalDue,
  canSendRenewalEvaluation,
  canSubmitRenewalEvaluation,
  canSubmitDeptHeadRecommendation,
  canDecideRenewalCase,
  requiresLinkedMovement,
  recommendationToMovementType,
  recommendationDurationMonths,
  isRenewalRecommendation,
  requiresChangeReason,
  isValidScoreValue,
  computeEvaluationTotal,
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
  it("only TRIGGERED can send evaluation", () => {
    expect(canSendRenewalEvaluation("TRIGGERED")).toBe(true);
    expect(canSendRenewalEvaluation("EVALUATION_SENT")).toBe(false);
  });

  it("evaluation submission requires EVALUATION_SENT and no prior submission", () => {
    expect(canSubmitRenewalEvaluation("EVALUATION_SENT", null)).toBe(true);
    expect(canSubmitRenewalEvaluation("EVALUATION_SENT", new Date())).toBe(false);
    expect(canSubmitRenewalEvaluation("TRIGGERED", null)).toBe(false);
  });

  it("dept head recommendation requires both evaluations submitted", () => {
    expect(canSubmitDeptHeadRecommendation("EVALUATION_SENT", new Date(), new Date())).toBe(true);
    expect(canSubmitDeptHeadRecommendation("EVALUATION_SENT", new Date(), null)).toBe(false);
    expect(canSubmitDeptHeadRecommendation("EVALUATION_SENT", null, null)).toBe(false);
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

  it("isRenewalRecommendation true only for Perpanjang variants", () => {
    expect(isRenewalRecommendation("PERPANJANG_3")).toBe(true);
    expect(isRenewalRecommendation("MUTASI")).toBe(false);
    expect(isRenewalRecommendation("TIDAK_DIPERPANJANG")).toBe(false);
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

describe("isValidScoreValue (FR-HC-01-07 form scale)", () => {
  it("accepts exactly 2/4/6/8", () => {
    expect(isValidScoreValue(2)).toBe(true);
    expect(isValidScoreValue(4)).toBe(true);
    expect(isValidScoreValue(6)).toBe(true);
    expect(isValidScoreValue(8)).toBe(true);
  });

  it("rejects anything off-scale", () => {
    expect(isValidScoreValue(0)).toBe(false);
    expect(isValidScoreValue(5)).toBe(false);
    expect(isValidScoreValue(10)).toBe(false);
  });
});

describe("computeEvaluationTotal", () => {
  it("sums the KPI/Productivity branch", () => {
    expect(computeEvaluationTotal({ kpiProductivity: 8, absensi: 6, tugasKhusus: 4, sp: 8, kompetensi: 6 })).toBe(32);
  });

  it("sums the 5-alternative-criteria branch when no KPI applies", () => {
    expect(
      computeEvaluationTotal({
        qualityOrientation: 8,
        problemSolving: 6,
        communicationLeadership: 6,
        technicalExpertise: 8,
        workDiscipline: 4,
      })
    ).toBe(32);
  });

  it("includes all five company-value scores individually", () => {
    expect(computeEvaluationTotal({ companyValues: [2, 4, 6, 8, 2] })).toBe(22);
  });

  it("is 0 for an empty scores object", () => {
    expect(computeEvaluationTotal({})).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  formatEvaluationNumber,
  canReleaseEvaluationStatus,
  canSubmitEvaluationSlot,
  isEvaluationComplete,
  isEvaluationGateSatisfied,
  isValidScoreValue,
  computeEvaluationTotal,
  requiresEvaluationForMovementType,
  movementTypeToEvaluationPurpose,
} from "./evaluation";

describe("formatEvaluationNumber", () => {
  it("formats like MOV-YYYY-NNNN but with the EVL prefix", () => {
    expect(formatEvaluationNumber(6, 2026)).toBe("EVL-2026-0006");
  });
});

describe("canReleaseEvaluationStatus (ACC-11/ACC-17)", () => {
  it("only a Draft can be released", () => {
    expect(canReleaseEvaluationStatus("DRAFT")).toBe(true);
    expect(canReleaseEvaluationStatus("RELEASED")).toBe(false);
    expect(canReleaseEvaluationStatus("COMPLETED")).toBe(false);
  });
});

describe("canSubmitEvaluationSlot", () => {
  it("requires RELEASED status and no prior submission", () => {
    expect(canSubmitEvaluationSlot("RELEASED", null)).toBe(true);
    expect(canSubmitEvaluationSlot("RELEASED", new Date())).toBe(false);
    expect(canSubmitEvaluationSlot("DRAFT", null)).toBe(false);
    expect(canSubmitEvaluationSlot("COMPLETED", null)).toBe(false);
  });
});

describe("isEvaluationComplete", () => {
  it("true only for COMPLETED", () => {
    expect(isEvaluationComplete("COMPLETED")).toBe(true);
    expect(isEvaluationComplete("RELEASED")).toBe(false);
    expect(isEvaluationComplete("DRAFT")).toBe(false);
  });
});

describe("isEvaluationGateSatisfied (WF-17/ACC-16)", () => {
  it("null status (legacy row, no linked Evaluation) never blocks", () => {
    expect(isEvaluationGateSatisfied(null)).toBe(true);
  });

  it("only COMPLETED satisfies the gate otherwise", () => {
    expect(isEvaluationGateSatisfied("COMPLETED")).toBe(true);
    expect(isEvaluationGateSatisfied("RELEASED")).toBe(false);
    expect(isEvaluationGateSatisfied("DRAFT")).toBe(false);
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

describe("requiresEvaluationForMovementType (DM-27/WF-17/LIF-14)", () => {
  it("true for all three Perubahan Posisi types", () => {
    expect(requiresEvaluationForMovementType("PROMOTION")).toBe(true);
    expect(requiresEvaluationForMovementType("MUTATION")).toBe(true);
    expect(requiresEvaluationForMovementType("DEMOTION")).toBe(true);
  });

  it("false for the legacy Rotasi and Perubahan Status types", () => {
    expect(requiresEvaluationForMovementType("ROTATION")).toBe(false);
    expect(requiresEvaluationForMovementType("STATUS_CHANGE")).toBe(false);
  });
});

describe("movementTypeToEvaluationPurpose", () => {
  it("maps each Perubahan Posisi type to its EvaluationPurpose", () => {
    expect(movementTypeToEvaluationPurpose("PROMOTION")).toBe("PROMOTION");
    expect(movementTypeToEvaluationPurpose("MUTATION")).toBe("MUTATION");
    expect(movementTypeToEvaluationPurpose("DEMOTION")).toBe("DEMOTION");
  });

  it("null for types that never create an Evaluation", () => {
    expect(movementTypeToEvaluationPurpose("ROTATION")).toBe(null);
    expect(movementTypeToEvaluationPurpose("STATUS_CHANGE")).toBe(null);
  });
});

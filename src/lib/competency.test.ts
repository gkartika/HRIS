import { describe, it, expect } from "vitest";
import {
  formatCycleCode,
  computeCompetencyGap,
  computeCompetencyAchievementPct,
  isValidCompanyValueScore,
  computeCompanyValueItemScore,
  computeCompanyValuesScore,
  isCompetencyAssessmentComplete,
} from "./competency";

describe("formatCycleCode", () => {
  it("formats like CYC-YYYY-NN", () => {
    expect(formatCycleCode(1, 2026)).toBe("CYC-2026-01");
    expect(formatCycleCode(2, 2026)).toBe("CYC-2026-02");
  });
});

describe("computeCompetencyGap (COM-07)", () => {
  it("gap = max(required - actual, 0)", () => {
    expect(computeCompetencyGap(4, 2)).toBe(2);
    expect(computeCompetencyGap(3, 3)).toBe(0);
  });

  it("an actual above target never produces a negative gap", () => {
    expect(computeCompetencyGap(2, 5)).toBe(0);
  });
});

describe("computeCompetencyAchievementPct (COM-07)", () => {
  it("sum(min(actual,required))/sum(required) over required items only", () => {
    const pct = computeCompetencyAchievementPct([
      { isRequired: true, requiredLevel: 4, actualLevel: 2 },
      { isRequired: true, requiredLevel: 3, actualLevel: 3 },
    ]);
    // achieved = min(2,4)+min(3,3) = 5; required = 7; 5/7*100
    expect(pct).toBeCloseTo((5 / 7) * 100, 5);
  });

  it("caps at 100% — an actual above target never exceeds its own requirement's contribution", () => {
    const pct = computeCompetencyAchievementPct([
      { isRequired: true, requiredLevel: 2, actualLevel: 5 },
      { isRequired: true, requiredLevel: 3, actualLevel: 3 },
    ]);
    expect(pct).toBe(100);
  });

  it("excludes N/A items (isRequired=false) entirely, not as zero", () => {
    const withNA = computeCompetencyAchievementPct([
      { isRequired: true, requiredLevel: 4, actualLevel: 4 },
      { isRequired: false, requiredLevel: null, actualLevel: null },
    ]);
    expect(withNA).toBe(100);
  });

  it("treats an unscored required item as actual=0", () => {
    const pct = computeCompetencyAchievementPct([{ isRequired: true, requiredLevel: 4, actualLevel: null }]);
    expect(pct).toBe(0);
  });

  it("returns null when there are no required items", () => {
    expect(computeCompetencyAchievementPct([])).toBeNull();
    expect(computeCompetencyAchievementPct([{ isRequired: false, requiredLevel: null, actualLevel: null }])).toBeNull();
  });
});

describe("isValidCompanyValueScore", () => {
  it("only accepts 0/25/50/75/100", () => {
    expect(isValidCompanyValueScore(75)).toBe(true);
    expect(isValidCompanyValueScore(60)).toBe(false);
  });
});

describe("computeCompanyValueItemScore (COM-14)", () => {
  it("average(p1,p2) x weight/100", () => {
    expect(computeCompanyValueItemScore(100, 50, 20)).toBeCloseTo(((100 + 50) / 2) * 0.2, 5);
  });

  it("null while either evaluator hasn't scored", () => {
    expect(computeCompanyValueItemScore(null, 50, 20)).toBeNull();
    expect(computeCompanyValueItemScore(50, null, 20)).toBeNull();
  });
});

describe("computeCompanyValuesScore (COM-14)", () => {
  it("sums five values each capped at their own weight when both sides score 100", () => {
    const items = Array.from({ length: 5 }, () => ({ p1Score: 100, p2Score: 100, weightSnapshot: 20 }));
    expect(computeCompanyValuesScore(items)).toBe(100);
  });

  it("null until all five items have both P1 and P2 recorded", () => {
    const items = [
      { p1Score: 100, p2Score: 100, weightSnapshot: 20 },
      { p1Score: 100, p2Score: null, weightSnapshot: 20 },
    ];
    expect(computeCompanyValuesScore(items)).toBeNull();
  });
});

describe("isCompetencyAssessmentComplete (COM-06/COM-15)", () => {
  it("requires both P1 and P2 submission timestamps", () => {
    expect(isCompetencyAssessmentComplete(new Date(), new Date())).toBe(true);
    expect(isCompetencyAssessmentComplete(new Date(), null)).toBe(false);
    expect(isCompetencyAssessmentComplete(null, null)).toBe(false);
  });
});

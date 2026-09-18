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

describe("computeCompanyValueItemScore (P1-only, P2 dropped per direct request)", () => {
  it("p1 x weight/100", () => {
    expect(computeCompanyValueItemScore(100, 20)).toBeCloseTo(100 * 0.2, 5);
  });

  it("null while P1 hasn't scored", () => {
    expect(computeCompanyValueItemScore(null, 20)).toBeNull();
  });
});

describe("computeCompanyValuesScore (P1-only, P2 dropped per direct request)", () => {
  it("sums five values each capped at their own weight when P1 scores 100", () => {
    const items = Array.from({ length: 5 }, () => ({ p1Score: 100, weightSnapshot: 20 }));
    expect(computeCompanyValuesScore(items)).toBe(100);
  });

  it("null until all five items have a P1 score recorded", () => {
    const items = [
      { p1Score: 100, weightSnapshot: 20 },
      { p1Score: null, weightSnapshot: 20 },
    ];
    expect(computeCompanyValuesScore(items)).toBeNull();
  });
});

describe("isCompetencyAssessmentComplete (P1-only, P2 dropped per direct request)", () => {
  it("requires only the P1 submission timestamp", () => {
    expect(isCompetencyAssessmentComplete(new Date())).toBe(true);
    expect(isCompetencyAssessmentComplete(null)).toBe(false);
  });
});

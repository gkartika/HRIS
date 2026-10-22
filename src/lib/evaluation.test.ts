import { describe, it, expect } from "vitest";
import {
  DEFAULT_MATRIX,
  buildMatrixDefinition,
  matrixDefinitionOf,
  performanceMaxTotal,
  type MatrixDefinition,
  isMatrixScores,
  parseEvaluationMatrix,
  performanceField,
  performanceSummary,
  tataNilaiAverage,
  tataNilaiField,
  allAssignedEvaluatorsSubmitted,
  averageMatrixScores,
  formatEvaluationNumber,
  canReleaseEvaluationStatus,
  canSubmitEvaluationSlot,
  isEvaluationComplete,
  isEvaluationGateSatisfied,
  isValidScoreValue,
  computeEvaluationTotal,
  requiresEvaluationForMovementType,
  movementNeedsEvaluation,
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

describe("evaluation matrix (performance 2/4/6/8, tata nilai 0/25/50/75/100)", () => {
  const def = DEFAULT_MATRIX;
  const form = (perf: number, tata: number) => {
    const fields: Record<string, string> = {};
    for (const c of def.performance) fields[performanceField(c.key)] = String(perf);
    for (const c of def.tataNilai) fields[tataNilaiField(c.key)] = String(tata);
    return fields;
  };
  const reader = (fields: Record<string, string>) => (name: string) => fields[name];

  it("starts with six performance criteria and five tata nilai", () => {
    expect(def.performance).toHaveLength(6);
    expect(def.tataNilai).toHaveLength(5);
    expect(def.performance[1].label).toBe("Komunikasi & Kolaborasi");
    expect(performanceMaxTotal(def)).toBe(48);
  });

  it("reads a complete form and works out the two results", () => {
    const fields = form(6, 75);
    fields[performanceField("kepemimpinan")] = "8";
    fields[tataNilaiField("legenda")] = "100";
    const parsed = parseEvaluationMatrix(def, reader(fields));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.scores.version).toBe(2);
    expect(isMatrixScores(parsed.scores)).toBe(true);
    expect(parsed.performanceTotal).toBe(5 * 6 + 8);
    expect(performanceSummary(parsed.scores, def)).toEqual({ total: 38, max: 48, percent: 79.2 });
    expect(tataNilaiAverage(parsed.scores, def)).toBe(80);
  });

  it("accepts the lowest and the highest grades", () => {
    const low = parseEvaluationMatrix(def, reader(form(2, 0)));
    const high = parseEvaluationMatrix(def, reader(form(8, 100)));
    expect(low.ok && performanceSummary(low.scores, def).percent).toBe(25);
    expect(high.ok && performanceSummary(high.scores, def).percent).toBe(100);
    expect(low.ok && tataNilaiAverage(low.scores, def)).toBe(0);
  });

  it("refuses a missing grade or a grade that is not on the scale", () => {
    const missing = form(4, 50);
    delete missing[performanceField("komunikasi")];
    expect(parseEvaluationMatrix(def, reader(missing)).ok).toBe(false);
    expect(parseEvaluationMatrix(def, reader({ ...form(4, 50), [performanceField("komunikasi")]: "5" })).ok).toBe(false);
    expect(parseEvaluationMatrix(def, reader({ ...form(4, 50), [tataNilaiField("jujur")]: "60" })).ok).toBe(false);
    expect(parseEvaluationMatrix(def, reader({ ...form(4, 50), [tataNilaiField("jujur")]: "" })).ok).toBe(false);
    // 100 is a tata nilai grade only; 0 is not a performance grade
    expect(parseEvaluationMatrix(def, reader({ ...form(4, 50), [performanceField("komunikasi")]: "0" })).ok).toBe(false);
  });

  it("works with whatever criteria an evaluation was released with", () => {
    const custom: MatrixDefinition = {
      performance: [{ key: "a", label: "A" }, { key: "c_new1", label: "Inisiatif" }],
      tataNilai: [{ key: "x", label: "X" }],
    };
    const fields = { [performanceField("a")]: "8", [performanceField("c_new1")]: "4", [tataNilaiField("x")]: "50" };
    const parsed = parseEvaluationMatrix(custom, reader(fields));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(performanceSummary(parsed.scores, custom)).toEqual({ total: 12, max: 16, percent: 75 });
    expect(tataNilaiAverage(parsed.scores, custom)).toBe(50);
    // a grade for a criterion the evaluation does not have is not required
    expect(parseEvaluationMatrix(custom, reader({ ...fields, [performanceField(def.performance[0].key)]: "6" })).ok).toBe(true);
    // but a missing one is
    expect(parseEvaluationMatrix(custom, reader({ [performanceField("a")]: "8", [tataNilaiField("x")]: "50" })).ok).toBe(false);
  });

  it("averages two evaluators criterion by criterion (and one evaluator stays as is)", () => {
    const make = (perf: number[], tata: number[]) =>
      parseEvaluationMatrix(def, (f) => {
        const m: Record<string, string> = {};
        def.performance.forEach((c, i) => (m[performanceField(c.key)] = String(perf[i])));
        def.tataNilai.forEach((c, i) => (m[tataNilaiField(c.key)] = String(tata[i])));
        return m[f];
      });
    const a = make([6, 8, 6, 4, 6, 8], [75, 100, 75, 75, 75]);
    const b = make([8, 8, 6, 6, 6, 8], [100, 75, 75, 50, 75]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const avg = averageMatrixScores([a.scores, b.scores], def);
    expect(avg && performanceSummary(avg, def)).toEqual({ total: 40, max: 48, percent: 83.3 });
    expect(avg && tataNilaiAverage(avg, def)).toBe(77.5);
    expect(averageMatrixScores([a.scores], def)).toEqual(a.scores);
    expect(averageMatrixScores([], def)).toBeNull();
  });

  it("does not mistake the older form for the new matrix", () => {
    expect(isMatrixScores({ qualityOrientation: 6, companyValues: [2, 4] })).toBe(false);
    expect(isMatrixScores(null)).toBe(false);
  });
});

describe("the criteria an evaluation is released with", () => {
  const rows = [
    { section: "PERFORMANCE" as const, key: "b", label: "B", sortOrder: 1, active: true },
    { section: "PERFORMANCE" as const, key: "a", label: "A", sortOrder: 0, active: true },
    { section: "PERFORMANCE" as const, key: "off", label: "Old", sortOrder: 2, active: false },
    { section: "TATA_NILAI" as const, key: "t", label: "T", sortOrder: 0, active: true },
  ];

  it("keeps the active criteria, in their order, per section", () => {
    expect(buildMatrixDefinition(rows)).toEqual({ performance: [{ key: "a", label: "A" }, { key: "b", label: "B" }], tataNilai: [{ key: "t", label: "T" }] });
  });

  it("reads a saved copy back, and falls back to the original criteria when there is none", () => {
    const saved = buildMatrixDefinition(rows);
    expect(matrixDefinitionOf(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(matrixDefinitionOf(null)).toBe(DEFAULT_MATRIX);
    expect(matrixDefinitionOf({ performance: [], tataNilai: [] })).toBe(DEFAULT_MATRIX);
    expect(matrixDefinitionOf({ performance: "x" })).toBe(DEFAULT_MATRIX);
  });
});

describe("allAssignedEvaluatorsSubmitted (one or two evaluators)", () => {
  const when = new Date("2026-10-21T00:00:00Z");
  it("with one evaluator (no P2) it is complete as soon as P1 submitted", () => {
    expect(allAssignedEvaluatorsSubmitted({ p1EmployeeId: "a", p1SubmittedAt: when, p2EmployeeId: null, p2SubmittedAt: null })).toBe(true);
    expect(allAssignedEvaluatorsSubmitted({ p1EmployeeId: "a", p1SubmittedAt: null, p2EmployeeId: null, p2SubmittedAt: null })).toBe(false);
  });
  it("with two evaluators both must have submitted", () => {
    expect(allAssignedEvaluatorsSubmitted({ p1EmployeeId: "a", p1SubmittedAt: when, p2EmployeeId: "b", p2SubmittedAt: null })).toBe(false);
    expect(allAssignedEvaluatorsSubmitted({ p1EmployeeId: "a", p1SubmittedAt: null, p2EmployeeId: "b", p2SubmittedAt: when })).toBe(false);
    expect(allAssignedEvaluatorsSubmitted({ p1EmployeeId: "a", p1SubmittedAt: when, p2EmployeeId: "b", p2SubmittedAt: when })).toBe(true);
  });
  it("nobody assigned is never complete", () => {
    expect(allAssignedEvaluatorsSubmitted({ p1EmployeeId: null, p1SubmittedAt: null, p2EmployeeId: null, p2SubmittedAt: null })).toBe(false);
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
  it("true for Promosi and Demosi", () => {
    expect(requiresEvaluationForMovementType("PROMOTION")).toBe(true);
    expect(requiresEvaluationForMovementType("DEMOTION")).toBe(true);
  });

  it("a move from internal recruitment needs none, whatever its type", () => {
    expect(movementNeedsEvaluation("PROMOTION", "REKRUTMEN_INTERNAL")).toBe(false);
    expect(movementNeedsEvaluation("DEMOTION", "REKRUTMEN_INTERNAL")).toBe(false);
    expect(movementNeedsEvaluation("PROMOTION", "MUTASI")).toBe(true);
    expect(movementNeedsEvaluation("MUTATION", "MUTASI")).toBe(false);
  });

  it("false for Mutasi: it needs no evaluation", () => {
    expect(requiresEvaluationForMovementType("MUTATION")).toBe(false);
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

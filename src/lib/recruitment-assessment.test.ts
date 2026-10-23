import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Session } from "next-auth";
import {
  EXPECTED,
  OPTION_KEYS,
  RubricNotApprovedError,
  V32_REFERENCE_MATRIX,
  isMaterialConcern,
  isRubricEditable,
  isRubricUsableForScoring,
  matrixDifferences,
  nextRubricLabel,
  nextRubricStatus,
  scoreAssessment,
  scoreDistribution,
  screeningStatusFor,
  validateAssessmentPackage,
  validateInterpretations,
  validateQuestionBank,
  type QuestionBankFile,
  type RubricFile,
  type ScoringInterpretation,
  type ScoringInput,
} from "./recruitment-assessment";
import { canApproveAssessmentRubric, canManageAssessmentRubric, canViewAssessmentResults, canViewAssessmentRubric } from "./permissions";
import { SOURCE_FILE_SHA256 } from "./recruitment-assessment-sources";
import bankJson from "./recruitment-assessment-data/cbp_v32_candidate_question_bank.json";
import rubricJson from "./recruitment-assessment-data/cbp_v32_hr_interpretation_rubric.json";

const bank = bankJson as unknown as QuestionBankFile;
const rubric = rubricJson as unknown as RubricFile;

const APPROVED = { id: "r1", status: "ACTIVE" as const, approvedAt: new Date("2026-10-22T00:00:00Z") };

// A rubric as the database would hand it over: one interpretation per option, ids derived from the keys.
function interpretationMap(source: RubricFile = rubric, rubricId = "r1") {
  const byOption = new Map<string, ScoringInterpretation>();
  for (const r of source.interpretations) {
    byOption.set(`o${r.questionId}${r.optionKey}`, {
      id: `i${rubricId}-${r.questionId}${r.optionKey}`,
      optionId: `o${r.questionId}${r.optionKey}`,
      questionNo: r.questionId,
      optionKey: r.optionKey,
      assessmentType: r.assessmentType,
      primaryDimension: r.primaryDimension,
      observation: r.behavioralObservation,
      riskSignal: r.riskSignal,
      requiresControlReview: r.requiresControlReview,
    });
  }
  return byOption;
}

const questions = bank.questions.map((q) => ({ id: `q${q.questionId}`, questionNo: q.questionId }));

// Answers by option key per question, e.g. pick("A") for all A, or overrides {14: "B"}.
function answersOf(defaultKey: string, overrides: Record<number, string> = {}) {
  const map = new Map<string, string>();
  for (const q of questions) map.set(q.id, `o${q.questionNo}${overrides[q.questionNo] ?? defaultKey}`);
  return map;
}

// The risk-free answer of each question (a 0 option), so we can start from a total of 0.
function zeroKey(questionNo: number): string {
  return OPTION_KEYS[V32_REFERENCE_MATRIX[questionNo].findIndex((v) => v === 0)];
}
const zeroOverrides = Object.fromEntries(questions.map((q) => [q.questionNo, zeroKey(q.questionNo)]));

function score(answers: Map<string, string>, overrides: Partial<ScoringInput> = {}) {
  return scoreAssessment({ rubric: APPROVED, questions, answers, interpretations: interpretationMap(), ...overrides });
}

// Answer key for a question with the wanted value, e.g. "a -2 on question 2" -> D.
function keyWith(questionNo: number, value: number): string {
  return OPTION_KEYS[V32_REFERENCE_MATRIX[questionNo].findIndex((v) => v === value)];
}

describe("1. master data: 20 questions and 80 options load", () => {
  it("has the V3.2 question bank with no structural problems", () => {
    expect(bank.assessmentVersion).toBe("V3.2");
    expect(bank.questions).toHaveLength(EXPECTED.questions);
    expect(bank.questions.every((q) => q.options.length === EXPECTED.optionsPerQuestion)).toBe(true);
    expect(bank.questions.flatMap((q) => q.options)).toHaveLength(80);
    expect(validateQuestionBank(bank)).toEqual([]);
  });

  it("rejects a bank with 19 questions, a duplicated option or a missing key", () => {
    const short = { ...bank, questions: bank.questions.slice(0, 19) };
    expect(validateQuestionBank(short).join(" ")).toContain("19");
    const dup = structuredClone(bank);
    dup.questions[0].options[1].text = dup.questions[0].options[0].text;
    expect(validateQuestionBank(dup).join(" ")).toContain("tidak boleh sama");
    const keys = structuredClone(bank);
    keys.questions[3].options[3].key = "E";
    expect(validateQuestionBank(keys).join(" ")).toContain("A, B, C, D");
  });
});

describe("2. every option has an interpretation and a valid risk score", () => {
  it("covers all 80 options with a signal of 0, -1 or -2", () => {
    expect(rubric.rubricVersion).toBe("V3.2-R1");
    expect(rubric.interpretations).toHaveLength(80);
    const items = rubric.interpretations.map((r) => ({ questionNo: r.questionId, optionKey: r.optionKey, riskSignal: r.riskSignal, observation: r.behavioralObservation, primaryDimension: r.primaryDimension }));
    expect(validateInterpretations(items)).toEqual([]);
    expect(rubric.interpretations.every((r) => [0, -1, -2].includes(r.riskSignal))).toBe(true);
  });

  it("flags a missing interpretation and an invalid signal", () => {
    const items = rubric.interpretations.map((r) => ({ questionNo: r.questionId, optionKey: r.optionKey, riskSignal: r.riskSignal, observation: r.behavioralObservation, primaryDimension: r.primaryDimension }));
    expect(validateInterpretations(items.slice(1)).join(" ")).toContain("seharusnya 80");
    const bad = items.map((i, n) => (n === 0 ? { ...i, riskSignal: -3 } : i));
    expect(validateInterpretations(bad).join(" ")).toContain("tidak valid");
    const blank = items.map((i, n) => (n === 5 ? { ...i, observation: "  " } : i));
    expect(validateInterpretations(blank).join(" ")).toContain("observasi perilaku kosong");
  });
});

describe("3. the rubric matches the approved score matrix", () => {
  it("has no difference from the matrix and the 58 / 14 / 8 totals", () => {
    const items = rubric.interpretations.map((r) => ({ questionNo: r.questionId, optionKey: r.optionKey, riskSignal: r.riskSignal, observation: "x", primaryDimension: "x" }));
    expect(matrixDifferences(items)).toEqual([]);
    expect(scoreDistribution(items)).toEqual({ zero: 58, minusOne: 14, minusTwo: 8 });
    expect(validateAssessmentPackage(bank, rubric)).toEqual({ ok: true, problems: [] });
  });

  it("stops publication (reports, never corrects) when one value differs", () => {
    const tampered = structuredClone(rubric);
    tampered.interpretations.find((r) => r.questionId === 4 && r.optionKey === "A")!.riskSignal = -1;
    const result = validateAssessmentPackage(bank, tampered);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("Tidak sesuai matriks: soal 4A");
    expect(result.problems.join(" ")).toContain("Opsi bernilai -1: 15");
  });

  it("the matrix itself has the expected totals and minimum", () => {
    const all = Object.values(V32_REFERENCE_MATRIX).flat();
    expect(all).toHaveLength(80);
    expect(all.filter((v) => v === 0)).toHaveLength(58);
    expect(all.filter((v) => v === -1)).toHaveLength(14);
    expect(all.filter((v) => v === -2)).toHaveLength(8);
    expect(Object.values(V32_REFERENCE_MATRIX).reduce((s, row) => s + Math.min(...row), 0)).toBe(EXPECTED.minTotal);
  });

  it("the source files are byte-for-byte the approved package (SHA-256)", () => {
    const dir = path.join(__dirname, "recruitment-assessment-data");
    for (const [file, hash] of Object.entries(SOURCE_FILE_SHA256)) {
      expect(createHash("sha256").update(readFileSync(path.join(dir, file))).digest("hex")).toBe(hash);
    }
  });
});

describe("4-8. screening status from the cumulative score", () => {
  it("4. all-zero answers give 0 and no aggregate concern", () => {
    const result = score(answersOf("A", zeroOverrides));
    expect(result).toMatchObject({ total: 0, status: "NO_AGGREGATE_CONCERN" });
    expect(result.status === "INCOMPLETE" ? 0 : result.items).toHaveLength(20);
  });

  it("5. one -2 answer gives -2 and no aggregate priority flag", () => {
    const result = score(answersOf("A", { ...zeroOverrides, 5: keyWith(5, -2) }));
    expect(result).toMatchObject({ total: -2, status: "NO_AGGREGATE_CONCERN" });
  });

  it("6. a total of -3 is INTERVIEW_ATTENTION", () => {
    const result = score(answersOf("A", { ...zeroOverrides, 5: keyWith(5, -2), 1: keyWith(1, -1) }));
    expect(result).toMatchObject({ total: -3, status: "INTERVIEW_ATTENTION" });
  });

  it("7. a total of -5 stays INTERVIEW_ATTENTION", () => {
    const result = score(answersOf("A", { ...zeroOverrides, 5: keyWith(5, -2), 2: keyWith(2, -2), 1: keyWith(1, -1) }));
    expect(result).toMatchObject({ total: -5, status: "INTERVIEW_ATTENTION" });
  });

  it("8. a total of -6 is PRIORITY_REVIEW", () => {
    const result = score(answersOf("A", { ...zeroOverrides, 5: keyWith(5, -2), 2: keyWith(2, -2), 11: keyWith(11, -2) }));
    expect(result).toMatchObject({ total: -6, status: "PRIORITY_REVIEW" });
  });

  it("thresholds are exact at every boundary", () => {
    expect([0, -1, -2].map(screeningStatusFor)).toEqual(["NO_AGGREGATE_CONCERN", "NO_AGGREGATE_CONCERN", "NO_AGGREGATE_CONCERN"]);
    expect([-3, -4, -5].map(screeningStatusFor)).toEqual(["INTERVIEW_ATTENTION", "INTERVIEW_ATTENTION", "INTERVIEW_ATTENTION"]);
    expect([-6, -7, -19].map(screeningStatusFor)).toEqual(["PRIORITY_REVIEW", "PRIORITY_REVIEW", "PRIORITY_REVIEW"]);
  });

  it("the worst possible answer sheet totals -19 and the best 0", () => {
    const worst = Object.fromEntries(questions.map((q) => [q.questionNo, OPTION_KEYS[V32_REFERENCE_MATRIX[q.questionNo].indexOf(Math.min(...V32_REFERENCE_MATRIX[q.questionNo]) as never)]]));
    expect(score(answersOf("A", worst))).toMatchObject({ total: -19, status: "PRIORITY_REVIEW" });
  });

  it("each question counts exactly once and the total is the sum of the 20 signals", () => {
    const result = score(answersOf("D"));
    if (result.status === "INCOMPLETE") throw new Error("expected a score");
    expect(result.items.map((i) => i.questionNo)).toEqual(Array.from({ length: 20 }, (_, n) => n + 1));
    expect(result.total).toBe(result.items.reduce((s, i) => s + i.interpretation.riskSignal, 0));
    // Column D of the matrix: -1 -2 -1 0 -2 0 0 -1 0 0 0 -1 0 0 -2 0 -1 0 -2 0
    expect(result.total).toBe(-13);
  });
});

describe("9. incomplete assessments cannot be scored", () => {
  it("returns INCOMPLETE without a final score and names the missing questions", () => {
    const answers = answersOf("A", zeroOverrides);
    answers.delete("q7");
    answers.delete("q20");
    const result = score(answers);
    expect(result).toEqual({ status: "INCOMPLETE", total: null, answered: 18, missingQuestionNos: [7, 20] });
  });

  it("no answers at all is INCOMPLETE too", () => {
    expect(score(new Map()).status).toBe("INCOMPLETE");
  });
});

describe("10. unapproved rubrics cannot be used for official scoring", () => {
  it.each(["DRAFT", "PENDING_APPROVAL"] as const)("refuses a %s rubric", (status) => {
    expect(() => score(answersOf("A"), { rubric: { id: "r1", status, approvedAt: null } })).toThrow(RubricNotApprovedError);
  });

  it("refuses a status that says approved but has no approval record", () => {
    expect(isRubricUsableForScoring({ status: "ACTIVE", approvedAt: null })).toBe(false);
  });

  it("accepts approved, active and archived (once approved) rubrics", () => {
    const approvedAt = new Date();
    for (const status of ["APPROVED", "ACTIVE", "ARCHIVED"] as const) expect(isRubricUsableForScoring({ status, approvedAt })).toBe(true);
  });

  it("a returned rubric is a draft again, editable, with the approval gone before it can be used", () => {
    expect(nextRubricStatus("PENDING_APPROVAL", "RETURN")).toBe("DRAFT");
    expect(isRubricEditable("DRAFT")).toBe(true);
  });
});

describe("rubric life cycle", () => {
  it("allows only the documented steps", () => {
    expect(nextRubricStatus("DRAFT", "SUBMIT")).toBe("PENDING_APPROVAL");
    expect(nextRubricStatus("PENDING_APPROVAL", "APPROVE")).toBe("APPROVED");
    expect(nextRubricStatus("APPROVED", "ACTIVATE")).toBe("ACTIVE");
    expect(nextRubricStatus("ACTIVE", "ARCHIVE")).toBe("ARCHIVED");
    // never straight to active, never approve a draft, never reopen an approved rubric
    expect(nextRubricStatus("DRAFT", "ACTIVATE")).toBeNull();
    expect(nextRubricStatus("DRAFT", "APPROVE")).toBeNull();
    expect(nextRubricStatus("PENDING_APPROVAL", "ACTIVATE")).toBeNull();
    expect(nextRubricStatus("APPROVED", "RETURN")).toBeNull();
    expect(nextRubricStatus("ACTIVE", "SUBMIT")).toBeNull();
    expect(nextRubricStatus("ARCHIVED", "ACTIVATE")).toBeNull();
  });

  it("locks every status except DRAFT", () => {
    for (const s of ["PENDING_APPROVAL", "APPROVED", "ACTIVE", "ARCHIVED"] as const) expect(isRubricEditable(s)).toBe(false);
  });

  it("numbers the next revision after the highest existing one", () => {
    expect(nextRubricLabel("V3.2", ["V3.2-R1"])).toBe("V3.2-R2");
    expect(nextRubricLabel("V3.2", ["V3.2-R1", "V3.2-R3", "V3.2-R2"])).toBe("V3.2-R4");
    expect(nextRubricLabel("V3.2", [])).toBe("V3.2-R1");
  });
});

describe("11. approved historical assessments stay unchanged after a rubric revision", () => {
  it("scoring with the old rubric is independent of a later revision", () => {
    const answers = answersOf("A", { ...zeroOverrides, 5: keyWith(5, -2) });
    const before = score(answers);
    // R2 changes the meaning of one option and is approved afterwards.
    const r2 = structuredClone(rubric);
    r2.interpretations.find((r) => r.questionId === 5 && r.optionKey === keyWith(5, -2))!.riskSignal = 0;
    const withR2 = scoreAssessment({ rubric: { id: "r2", status: "ACTIVE", approvedAt: new Date() }, questions, answers, interpretations: interpretationMap(r2, "r2") });
    expect(withR2).toMatchObject({ total: 0 });
    // The first result was calculated from R1 and a recalculation with R1 stays identical.
    expect(before).toMatchObject({ total: -2 });
    expect(score(answers)).toEqual(before);
    if (before.status === "INCOMPLETE") throw new Error("expected a score");
    expect(before.items.every((i) => i.rubricId === "r1")).toBe(true);
  });
});

describe("12. unauthorized users cannot view or modify restricted scoring records", () => {
  const as = (roles: string[]) => ({ user: { roles } }) as unknown as Session;
  const hrManager = ["pos-hr-manager"];

  it("Admin Rekrutmen prepares and reads the scoring; the HR Manager approves and reads", () => {
    const recruiter = as(["RECRUITMENT_ADMIN"]);
    expect(canManageAssessmentRubric(recruiter)).toBe(true);
    expect(canViewAssessmentRubric(recruiter, [])).toBe(true);
    expect(canViewAssessmentResults(recruiter, [])).toBe(true);
    expect(canApproveAssessmentRubric(hrManager)).toBe(true);
    expect(canViewAssessmentRubric(as([]), hrManager)).toBe(true);
    expect(canViewAssessmentResults(as([]), hrManager)).toBe(true);
  });

  it("Admin SDM, Training Admin, GA Admin and plain employees have no access", () => {
    for (const roles of [["HR_ADMIN"], ["TRAINING_ADMIN"], ["GA_ADMIN"], []]) {
      const s = as(roles);
      expect(canManageAssessmentRubric(s)).toBe(false);
      expect(canViewAssessmentRubric(s, [])).toBe(false);
      expect(canViewAssessmentResults(s, [])).toBe(false);
    }
    expect(canApproveAssessmentRubric([])).toBe(false);
  });

  it("Admin Rekrutmen cannot approve: that needs an active HR Manager Position", () => {
    expect(canApproveAssessmentRubric([])).toBe(false);
  });
});

describe("14. every result traces to the exact question-answer interpretation records", () => {
  it("each scored item carries the question, option, interpretation and rubric references", () => {
    const result = score(answersOf("C"));
    if (result.status === "INCOMPLETE") throw new Error("expected a score");
    for (const item of result.items) {
      expect(item.questionId).toBe(`q${item.questionNo}`);
      expect(item.optionId).toBe(`o${item.questionNo}C`);
      expect(item.rubricId).toBe("r1");
      expect(item.interpretation.optionId).toBe(item.optionId);
      expect(item.interpretation.questionNo).toBe(item.questionNo);
      const source = rubric.interpretations.find((r) => r.questionId === item.questionNo && r.optionKey === "C")!;
      expect(item.interpretation.observation).toBe(source.behavioralObservation);
      expect(item.interpretation.riskSignal).toBe(source.riskSignal);
      expect(item.interpretation.primaryDimension).toBe(source.primaryDimension);
    }
  });

  it("an answer the rubric has no interpretation for is an error, never a silent zero", () => {
    const interpretations = interpretationMap();
    interpretations.delete("o3B");
    expect(() => score(answersOf("B"), { interpretations })).toThrow(/soal 3/);
  });

  it("an interpretation filed under another question is rejected", () => {
    const interpretations = interpretationMap();
    const wrong = { ...interpretations.get("o3B")!, questionNo: 9 };
    interpretations.set("o3B", wrong);
    expect(() => score(answersOf("B"), { interpretations })).toThrow(/soal 3/);
  });
});

describe("material concerns are shown even when the total is above -6", () => {
  it("flags every -2 answer and every control-review option", () => {
    const flagged = rubric.interpretations.filter((r) => isMaterialConcern({ riskSignal: r.riskSignal, requiresControlReview: r.requiresControlReview }));
    expect(flagged).toHaveLength(8);
    expect(flagged.every((r) => r.riskSignal === -2)).toBe(true);
    const result = score(answersOf("A", { ...zeroOverrides, 5: keyWith(5, -2) }));
    if (result.status === "INCOMPLETE") throw new Error("expected a score");
    expect(result.status).toBe("NO_AGGREGATE_CONCERN");
    expect(result.items.filter((i) => isMaterialConcern(i.interpretation)).map((i) => i.questionNo)).toEqual([5]);
  });
});

describe("when the assessment opens for an applicant", () => {
  const base = { status: "TESTING", closedAt: null };

  it("is open from the start for an applicant still in the process (it is the first test)", async () => {
    const { isAssessmentOpenFor } = await import("./recruitment-assessment");
    expect(isAssessmentOpenFor(base)).toBe(true);
    expect(isAssessmentOpenFor({ status: "AWAITING_REVIEW", closedAt: null })).toBe(true);
  });

  it("stays closed for an applicant who left the process", async () => {
    const { isAssessmentOpenFor } = await import("./recruitment-assessment");
    for (const status of ["TEST_FAILED", "REJECTED", "OFFER_DECLINED", "NOT_SELECTED", "HIRED"]) {
      expect(isAssessmentOpenFor({ status, closedAt: null })).toBe(false);
    }
    expect(isAssessmentOpenFor({ status: "TESTING", closedAt: new Date() })).toBe(false);
  });
});

describe("the 30-minute limit", () => {
  const started = new Date("2026-10-22T08:00:00Z");
  const at = (minutes: number, seconds = 0) => new Date(started.getTime() + (minutes * 60 + seconds) * 1000);

  it("the deadline is exactly 30 minutes after the start", async () => {
    const { assessmentDeadline, ASSESSMENT_TIME_LIMIT_MINUTES } = await import("./recruitment-assessment");
    expect(ASSESSMENT_TIME_LIMIT_MINUTES).toBe(30);
    expect(assessmentDeadline(started).toISOString()).toBe("2026-10-22T08:30:00.000Z");
  });

  it("is open before the deadline, and for a short grace after it, then closed", async () => {
    const { isAssessmentExpired } = await import("./recruitment-assessment");
    expect(isAssessmentExpired(started, at(0))).toBe(false);
    expect(isAssessmentExpired(started, at(29, 59))).toBe(false);
    expect(isAssessmentExpired(started, at(30))).toBe(false);
    expect(isAssessmentExpired(started, at(30, 20))).toBe(false);
    expect(isAssessmentExpired(started, at(30, 21))).toBe(true);
    expect(isAssessmentExpired(started, at(31))).toBe(true);
  });

  it("with no grace the limit is exact", async () => {
    const { isAssessmentExpired } = await import("./recruitment-assessment");
    expect(isAssessmentExpired(started, at(30), 0)).toBe(false);
    expect(isAssessmentExpired(started, at(30, 1), 0)).toBe(true);
  });
});

describe("the time limit is set per assessment", () => {
  const started = new Date("2026-10-22T08:00:00Z");
  const at = (minutes: number, seconds = 0) => new Date(started.getTime() + (minutes * 60 + seconds) * 1000);

  it("accepts whole minutes from 5 to 240 and nothing else", async () => {
    const { isValidTimeLimit } = await import("./recruitment-assessment");
    for (const ok of [5, 30, 45, 90, 240]) expect(isValidTimeLimit(ok)).toBe(true);
    for (const bad of [0, 4, 241, -30, 30.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(isValidTimeLimit(bad)).toBe(false);
  });

  it("each attempt uses its own limit for the deadline and the expiry", async () => {
    const { assessmentDeadline, isAssessmentExpired } = await import("./recruitment-assessment");
    expect(assessmentDeadline(started, 45).toISOString()).toBe("2026-10-22T08:45:00.000Z");
    expect(assessmentDeadline(started, 15).toISOString()).toBe("2026-10-22T08:15:00.000Z");
    // 20 minutes in: open with a 45-minute limit, over with a 15-minute limit
    expect(isAssessmentExpired(started, at(20), 20, 45)).toBe(false);
    expect(isAssessmentExpired(started, at(20), 20, 15)).toBe(true);
    // the grace still applies on top of any limit
    expect(isAssessmentExpired(started, at(45, 20), 20, 45)).toBe(false);
    expect(isAssessmentExpired(started, at(45, 21), 20, 45)).toBe(true);
  });

  it("without a limit given it is the default 30 minutes", async () => {
    const { isAssessmentExpired, ASSESSMENT_TIME_LIMIT_MINUTES } = await import("./recruitment-assessment");
    expect(ASSESSMENT_TIME_LIMIT_MINUTES).toBe(30);
    expect(isAssessmentExpired(started, at(31))).toBe(true);
  });
});

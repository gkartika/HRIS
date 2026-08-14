import { describe, it, expect } from "vitest";
import {
  computeQuizAttemptScore,
  isQuizPassed,
  canRetryQuiz,
  areRequiredMaterialsComplete,
  isLearningAssignmentComplete,
  canCompleteOnlineLearningAssignment,
} from "./lms";

describe("computeQuizAttemptScore", () => {
  it("scores single-choice correctly", () => {
    const questions = [{ id: "q1", points: 1, correctOptionIds: ["a"] }];
    expect(computeQuizAttemptScore(questions, { q1: ["a"] })).toBe(100);
    expect(computeQuizAttemptScore(questions, { q1: ["b"] })).toBe(0);
  });

  it("requires an exact set match for multiple-choice — no partial credit", () => {
    const questions = [{ id: "q1", points: 1, correctOptionIds: ["a", "b"] }];
    expect(computeQuizAttemptScore(questions, { q1: ["a", "b"] })).toBe(100);
    expect(computeQuizAttemptScore(questions, { q1: ["a"] })).toBe(0);
    expect(computeQuizAttemptScore(questions, { q1: ["a", "b", "c"] })).toBe(0);
  });

  it("weights by points, not a flat question count", () => {
    const questions = [
      { id: "q1", points: 1, correctOptionIds: ["a"] },
      { id: "q2", points: 3, correctOptionIds: ["b"] },
    ];
    // only the 3-point question correct: 3/4 = 75%
    expect(computeQuizAttemptScore(questions, { q1: ["x"], q2: ["b"] })).toBe(75);
  });

  it("treats a missing answer as incorrect, not a crash", () => {
    const questions = [{ id: "q1", points: 1, correctOptionIds: ["a"] }];
    expect(computeQuizAttemptScore(questions, {})).toBe(0);
  });

  it("returns 0 for a quiz with zero total points rather than dividing by zero", () => {
    expect(computeQuizAttemptScore([], {})).toBe(0);
  });
});

describe("isQuizPassed", () => {
  it("passes at or above the threshold", () => {
    expect(isQuizPassed(70, 70)).toBe(true);
    expect(isQuizPassed(69.9, 70)).toBe(false);
  });
});

describe("canRetryQuiz", () => {
  it("allows retry until attempts reach maxAttempts + bonusAttempts", () => {
    expect(canRetryQuiz(2, 3, 0)).toBe(true);
    expect(canRetryQuiz(3, 3, 0)).toBe(false);
    expect(canRetryQuiz(3, 3, 1)).toBe(true);
    expect(canRetryQuiz(4, 3, 1)).toBe(false);
  });
});

describe("areRequiredMaterialsComplete", () => {
  it("ignores non-required materials", () => {
    const materials = [
      { id: "m1", isRequired: true },
      { id: "m2", isRequired: false },
    ];
    expect(areRequiredMaterialsComplete(materials, new Set(["m1"]))).toBe(true);
    expect(areRequiredMaterialsComplete(materials, new Set())).toBe(false);
  });
});

describe("isLearningAssignmentComplete (PDF workflow section C)", () => {
  it("ONLINE requires materials and quiz (if required)", () => {
    expect(
      isLearningAssignmentComplete({
        mode: "ONLINE",
        requiredMaterialsComplete: true,
        quizRequired: true,
        quizPassed: true,
        attendanceConfirmed: false,
      })
    ).toBe(true);
    expect(
      isLearningAssignmentComplete({
        mode: "ONLINE",
        requiredMaterialsComplete: true,
        quizRequired: true,
        quizPassed: false,
        attendanceConfirmed: false,
      })
    ).toBe(false);
    expect(
      isLearningAssignmentComplete({
        mode: "ONLINE",
        requiredMaterialsComplete: true,
        quizRequired: false,
        quizPassed: false,
        attendanceConfirmed: false,
      })
    ).toBe(true);
  });

  it("IN_PERSON requires only attendance, regardless of materials/quiz", () => {
    expect(
      isLearningAssignmentComplete({
        mode: "IN_PERSON",
        requiredMaterialsComplete: false,
        quizRequired: true,
        quizPassed: false,
        attendanceConfirmed: true,
      })
    ).toBe(true);
    expect(
      isLearningAssignmentComplete({
        mode: "IN_PERSON",
        requiredMaterialsComplete: true,
        quizRequired: false,
        quizPassed: false,
        attendanceConfirmed: false,
      })
    ).toBe(false);
  });

  it("BLENDED requires both the online part and attendance", () => {
    expect(
      isLearningAssignmentComplete({
        mode: "BLENDED",
        requiredMaterialsComplete: true,
        quizRequired: false,
        quizPassed: false,
        attendanceConfirmed: true,
      })
    ).toBe(true);
    expect(
      isLearningAssignmentComplete({
        mode: "BLENDED",
        requiredMaterialsComplete: true,
        quizRequired: false,
        quizPassed: false,
        attendanceConfirmed: false,
      })
    ).toBe(false);
    expect(
      isLearningAssignmentComplete({
        mode: "BLENDED",
        requiredMaterialsComplete: false,
        quizRequired: false,
        quizPassed: false,
        attendanceConfirmed: true,
      })
    ).toBe(false);
  });
});

describe("canCompleteOnlineLearningAssignment", () => {
  it("only allows completing directly from ASSIGNED — no attendance step for Online", () => {
    expect(canCompleteOnlineLearningAssignment("ASSIGNED")).toBe(true);
    expect(canCompleteOnlineLearningAssignment("ATTENDED")).toBe(false);
    expect(canCompleteOnlineLearningAssignment("COMPLETED")).toBe(false);
    expect(canCompleteOnlineLearningAssignment("CANCELLED")).toBe(false);
  });
});

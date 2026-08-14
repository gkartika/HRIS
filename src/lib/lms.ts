// Pure business logic for Phase 3B Learning Library / LMS. No Prisma/Next
// imports — unit testable, same pattern as competency.ts/training.ts.
import type { CourseStatus } from "@/generated/prisma/enums";

// A. COURSE AUTHORING: Draft -> Published -> Archived. Re-publishing an
// Archived course is allowed (no un-archive-then-republish two-step
// required) — Training Admin owns content end to end and the workflow
// diagram doesn't call for a one-way gate here.
export function canPublishCourse(status: CourseStatus): boolean {
  return status === "DRAFT" || status === "ARCHIVED";
}

export function canArchiveCourse(status: CourseStatus): boolean {
  return status === "DRAFT" || status === "PUBLISHED";
}

export interface QuizScoringQuestion {
  id: string;
  points: number;
  correctOptionIds: string[];
}

export type QuizAttemptAnswers = Record<string, string[]>;

// Key Control "Server-side quiz scoring": no partial credit for
// MULTIPLE_CHOICE — a question is correct only when the learner's selected
// option set exactly equals the correct-option set (matches how
// SINGLE_CHOICE/TRUE_FALSE already behave, since both only ever have one
// correct option). Score is points-weighted, not a flat question count, so
// a course author can weight harder questions higher.
export function computeQuizAttemptScore(questions: QuizScoringQuestion[], answers: QuizAttemptAnswers): number {
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  if (totalPoints === 0) return 0;

  let earned = 0;
  for (const q of questions) {
    const selected = new Set(answers[q.id] ?? []);
    const correct = new Set(q.correctOptionIds);
    const isCorrect = selected.size === correct.size && [...selected].every((id) => correct.has(id));
    if (isCorrect) earned += q.points;
  }
  return (earned / totalPoints) * 100;
}

export function isQuizPassed(scorePercent: number, passingScorePercent: number): boolean {
  return scorePercent >= passingScorePercent;
}

// Key Control "Audited retry reset": `bonusAttempts` only ever grows through
// an audited Training Admin action (see lib/import-export equivalents) —
// this function itself is just arithmetic, so it stays trivially testable.
export function canRetryQuiz(attemptsUsed: number, maxAttempts: number, bonusAttempts: number): boolean {
  return attemptsUsed < maxAttempts + bonusAttempts;
}

export interface MaterialRequirement {
  id: string;
  isRequired: boolean;
}

export function areRequiredMaterialsComplete(materials: MaterialRequirement[], completedMaterialIds: Set<string>): boolean {
  return materials.filter((m) => m.isRequired).every((m) => completedMaterialIds.has(m.id));
}

export interface CompletionCheckInput {
  mode: "ONLINE" | "IN_PERSON" | "BLENDED";
  requiredMaterialsComplete: boolean;
  quizRequired: boolean;
  quizPassed: boolean;
  attendanceConfirmed: boolean;
}

// PDF workflow section C: ONLINE = all required materials + quiz (if
// required); IN_PERSON = attendance recorded by admin; BLENDED = both.
// Competency scores are never touched here or anywhere in this module
// (COM-12/TRN-15) — completion is purely a Training/LearningAssignment
// concern.
export function isLearningAssignmentComplete(input: CompletionCheckInput): boolean {
  const onlinePartDone = input.requiredMaterialsComplete && (!input.quizRequired || input.quizPassed);
  if (input.mode === "ONLINE") return onlinePartDone;
  if (input.mode === "IN_PERSON") return input.attendanceConfirmed;
  return onlinePartDone && input.attendanceConfirmed;
}

// An Online assignment has no attendance step at all — it goes straight
// from ASSIGNED to COMPLETED once isLearningAssignmentComplete(...) is true
// (checked separately by the caller), unlike In-person/Blended which must
// pass through ATTENDED first (see canConfirmLearningAssignmentAttendance/
// canCompleteLearningAssignment in lib/training.ts).
export function canCompleteOnlineLearningAssignment(status: "ASSIGNED" | "ATTENDED" | "COMPLETED" | "CANCELLED"): boolean {
  return status === "ASSIGNED";
}

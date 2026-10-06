"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canTakeQuiz } from "@/lib/permissions";
import { computeQuizAttemptScore, isQuizPassed, canRetryQuiz } from "@/lib/lms";
import type { QuizScoringQuestion, QuizAttemptAnswers } from "@/lib/lms";
import { logAudit } from "@/lib/audit";

// Self-service — a learner may only ever touch their own LearningAssignment
// rows (canTakeQuiz), and only while it's still in progress.
export async function markCourseMaterialComplete(assignmentId: string, materialId: string): Promise<void> {
  const session = await requireSession();

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || !canTakeQuiz(session, assignment.employeeId)) return;
  if (assignment.status === "CANCELLED" || assignment.status === "COMPLETED") return;

  const material = await prisma.courseMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.courseId !== assignment.courseId) return;

  await prisma.learningAssignmentMaterialProgress.upsert({
    where: { learningAssignmentId_materialId: { learningAssignmentId: assignmentId, materialId } },
    create: { learningAssignmentId: assignmentId, materialId },
    update: {},
  });

  revalidatePath(`/training/my-learning/${assignmentId}`);
}

// Key Control "Server-side quiz scoring": the learner's raw selections are
// the only client input trusted here — correctness, points, passing
// threshold and retry-limit enforcement are all recomputed from the
// database on every submission, never taken from the client.
export async function submitQuizAttempt(assignmentId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || !canTakeQuiz(session, assignment.employeeId)) return "Anda tidak memiliki akses.";
  if (assignment.status === "CANCELLED" || assignment.status === "COMPLETED") {
    return "Kuis tidak dapat diambil untuk penugasan ini.";
  }

  const quiz = await prisma.quiz.findUnique({
    where: { courseId: assignment.courseId },
    include: { questions: { include: { options: true } } },
  });
  if (!quiz) return "Kuis tidak tersedia untuk pelatihan ini.";
  if (quiz.questions.length === 0) return "Kuis belum memiliki pertanyaan.";

  const attemptsUsed = await prisma.quizAttempt.count({ where: { learningAssignmentId: assignmentId, quizId: quiz.id } });
  if (!canRetryQuiz(attemptsUsed, quiz.maxAttempts, assignment.quizBonusAttempts)) {
    return "Batas percobaan kuis untuk penugasan ini sudah tercapai. Hubungi Training Admin untuk pengaturan ulang.";
  }

  const scoringQuestions: QuizScoringQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    points: q.points,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
  }));
  const answers: QuizAttemptAnswers = {};
  for (const q of quiz.questions) {
    const selected = formData.getAll(`answer_${q.id}`).map(String).filter(Boolean);
    if (selected.length > 0) answers[q.id] = selected;
  }

  const scorePercent = computeQuizAttemptScore(scoringQuestions, answers);
  const passed = isQuizPassed(scorePercent, quiz.passingScorePercent);

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        learningAssignmentId: assignmentId,
        quizId: quiz.id,
        attemptNumber: attemptsUsed + 1,
        submittedAt: new Date(),
        scorePercent,
        passed,
      },
    });
    await tx.quizAttemptAnswer.createMany({
      data: Object.entries(answers).flatMap(([questionId, optionIds]) =>
        optionIds.map((optionId) => ({ attemptId: created.id, questionId, optionId }))
      ),
    });
    return created;
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "QuizAttempt",
    recordId: attempt.id,
    reason: `Quiz attempt ${attempt.attemptNumber} submitted — score ${scorePercent.toFixed(1)}%, ${passed ? "passed" : "failed"}`,
  });

  revalidatePath(`/training/my-learning/${assignmentId}`);
}

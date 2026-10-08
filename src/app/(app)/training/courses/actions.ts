"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageTrainingCourse } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { canPublishCourse, canArchiveCourse } from "@/lib/lms";
import type { CourseDeliveryMode, CourseMaterialType, QuizQuestionType } from "@/generated/prisma/enums";

// Only PDF/DOCX/PPTX are file-backed materials (VIDEO/URL are always
// external links, never uploaded — see CourseMaterial's schema comment).
const COURSE_MATERIAL_FILE_RULES: Record<string, { mimeTypes: string[]; extension: string }> = {
  PDF: { mimeTypes: ["application/pdf"], extension: ".pdf" },
  DOCX: {
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    extension: ".docx",
  },
  PPTX: {
    mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    extension: ".pptx",
  },
};
const MAX_COURSE_MATERIAL_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — training decks run larger than HR documents

// TRN-11/ACC-22: "Training Admin may create courses and sessions manually.
// Creation alone does not enroll anyone" — no learner-facing side effect
// happens here at all. New courses always start as Draft (schema default);
// Publish is a separate, explicit action below.
export async function createTrainingCourse(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return t("common.forbidden");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return "Judul pelatihan wajib diisi.";

  const category = (formData.get("category") as string)?.trim() || null;
  const provider = (formData.get("provider") as string)?.trim() || null;
  const deliveryMethod = (formData.get("deliveryMethod") as string)?.trim() || null;
  const modeRaw = formData.get("mode") as string;
  const mode: CourseDeliveryMode = ["ONLINE", "IN_PERSON", "BLENDED"].includes(modeRaw)
    ? (modeRaw as CourseDeliveryMode)
    : "ONLINE";
  const objectives = (formData.get("objectives") as string)?.trim() || null;
  const plannedCostRaw = (formData.get("plannedCost") as string)?.trim();
  const plannedCost = plannedCostRaw ? Number(plannedCostRaw) : null;
  const certificateRequired = formData.get("certificateRequired") === "on";
  const effectivenessRequired = formData.get("effectivenessRequired") === "on";
  const isOnboardingRequired = formData.get("isOnboardingRequired") === "on";
  const effectivenessFollowupDaysRaw = (formData.get("effectivenessFollowupDays") as string)?.trim();
  const effectivenessFollowupDays = effectivenessFollowupDaysRaw ? Number(effectivenessFollowupDaysRaw) : 30;

  const course = await prisma.trainingCourse.create({
    data: {
      title,
      category,
      provider,
      deliveryMethod,
      mode,
      objectives,
      plannedCost,
      certificateRequired,
      effectivenessRequired,
      isOnboardingRequired,
      effectivenessFollowupDays,
      createdByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "TrainingCourse",
    recordId: course.id,
    reason: `Created course "${title}"`,
  });

  revalidatePath("/training/courses");
  redirect(`/training/courses/${course.id}`);
}

export async function createTrainingSession(
  courseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return t("common.forbidden");

  const startDateRaw = formData.get("startDate") as string;
  if (!startDateRaw) return "Tanggal mulai wajib diisi.";
  const endDateRaw = formData.get("endDate") as string | null;
  const location = (formData.get("location") as string)?.trim() || null;
  const capacityRaw = (formData.get("capacity") as string)?.trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  const trainingSession = await prisma.trainingSession.create({
    data: {
      courseId,
      startDate: new Date(startDateRaw),
      endDate: endDateRaw ? new Date(endDateRaw) : null,
      location,
      capacity,
      createdByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "TrainingSession",
    recordId: trainingSession.id,
    reason: `Created session for course ${courseId}`,
  });

  revalidatePath(`/training/courses/${courseId}`);
  redirect(`/training/courses/${courseId}`);
}

// TRN-12: ordered content within a course. PDF/DOCX/PPTX are uploaded and
// stored through the same private FileObject pattern as every other document
// in this app (category "COURSE_MATERIAL", served only via /api/files/[id]);
// VIDEO/URL are always an external link, never uploaded.
export async function addCourseMaterial(
  courseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return t("common.forbidden");

  const course = await prisma.trainingCourse.findUnique({ where: { id: courseId } });
  if (!course) return "Pelatihan tidak ditemukan.";

  const title = (formData.get("title") as string)?.trim();
  if (!title) return "Judul materi wajib diisi.";
  const materialTypeRaw = formData.get("materialType") as string;
  if (!["PDF", "DOCX", "PPTX", "VIDEO", "URL"].includes(materialTypeRaw)) return "Jenis materi tidak valid.";
  const materialType = materialTypeRaw as CourseMaterialType;
  const isRequired = formData.get("isRequired") === "on";

  let fileId: string | null = null;
  let externalUrl: string | null = null;

  if (materialType === "VIDEO" || materialType === "URL") {
    externalUrl = (formData.get("externalUrl") as string)?.trim();
    if (!externalUrl) return "Tautan wajib diisi untuk jenis materi ini.";
  } else {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return "Pilih berkas terlebih dahulu.";
    const rule = COURSE_MATERIAL_FILE_RULES[materialType];
    if (!rule.mimeTypes.includes(file.type) || getExtension(file.name) !== rule.extension) {
      return `Jenis berkas tidak sesuai. Gunakan berkas ${materialType}.`;
    }
    if (file.size > MAX_COURSE_MATERIAL_SIZE_BYTES) return "Ukuran berkas melebihi batas maksimum 25 MB.";

    const storageKey = randomStorageKey("course-material", getExtension(file.name));
    const bytes = Buffer.from(await file.arrayBuffer());
    await savePrivateFile(storageKey, bytes);

    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        sensitivity: "RESTRICTED",
        uploadedByAccountId: session.user.id,
        category: "COURSE_MATERIAL",
        confidential: false,
      },
    });
    fileId = fileObject.id;
  }

  const maxOrder = await prisma.courseMaterial.aggregate({ where: { courseId }, _max: { displayOrder: true } });
  const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

  const material = await prisma.courseMaterial.create({
    data: { courseId, displayOrder, title, materialType, fileId, externalUrl, isRequired },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "CourseMaterial",
    recordId: material.id,
    reason: `Added material "${title}" to course "${course.title}"`,
  });

  revalidatePath(`/training/courses/${courseId}`);
}

// Swaps displayOrder with the adjacent material — the whole reorder UI is
// just two buttons per row, no drag-and-drop plumbing needed.
export async function moveCourseMaterial(materialId: string, direction: "up" | "down"): Promise<void> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return;

  const material = await prisma.courseMaterial.findUnique({ where: { id: materialId } });
  if (!material) return;

  const neighbor = await prisma.courseMaterial.findFirst({
    where: {
      courseId: material.courseId,
      displayOrder: direction === "up" ? { lt: material.displayOrder } : { gt: material.displayOrder },
    },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.courseMaterial.update({ where: { id: material.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.courseMaterial.update({ where: { id: neighbor.id }, data: { displayOrder: material.displayOrder } }),
  ]);

  revalidatePath(`/training/courses/${material.courseId}`);
}

// One Quiz per course (schema: Quiz.courseId is @unique) — configured once
// at authoring time, not per-assignment.
export async function createQuiz(
  courseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return t("common.forbidden");

  const course = await prisma.trainingCourse.findUnique({ where: { id: courseId }, include: { quiz: true } });
  if (!course) return "Pelatihan tidak ditemukan.";
  if (course.quiz) return "Kuis untuk pelatihan ini sudah ada.";

  const passingScoreRaw = (formData.get("passingScorePercent") as string)?.trim();
  const passingScorePercent = passingScoreRaw ? Number(passingScoreRaw) : 70;
  if (!Number.isFinite(passingScorePercent) || passingScorePercent < 1 || passingScorePercent > 100) {
    return "Nilai kelulusan harus antara 1-100.";
  }
  const maxAttemptsRaw = (formData.get("maxAttempts") as string)?.trim();
  const maxAttempts = maxAttemptsRaw ? Number(maxAttemptsRaw) : 3;
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) return "Batas percobaan harus minimal 1.";

  const quiz = await prisma.quiz.create({ data: { courseId, passingScorePercent, maxAttempts } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Quiz",
    recordId: quiz.id,
    reason: `Created quiz for course "${course.title}"`,
  });

  revalidatePath(`/training/courses/${courseId}`);
}

// TRUE_FALSE is always exactly two fixed options ("Benar"/"Salah") — the
// learner only ever picks which one is correct, no free-text entry.
// SINGLE_CHOICE/MULTIPLE_CHOICE take up to 4 free-text options; scoring
// itself (server-side, exact-set match) lives in lib/lms.ts.
export async function addQuizQuestion(
  quizId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return t("common.forbidden");

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { course: true } });
  if (!quiz) return "Kuis tidak ditemukan.";

  const questionText = (formData.get("questionText") as string)?.trim();
  if (!questionText) return "Pertanyaan wajib diisi.";
  const questionTypeRaw = formData.get("questionType") as string;
  if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(questionTypeRaw)) return "Tipe pertanyaan tidak valid.";
  const questionType = questionTypeRaw as QuizQuestionType;
  const pointsRaw = (formData.get("points") as string)?.trim();
  const points = pointsRaw ? Number(pointsRaw) : 1;
  if (!Number.isFinite(points) || points < 1) return "Poin harus angka positif.";

  let options: { optionText: string; isCorrect: boolean }[];

  if (questionType === "TRUE_FALSE") {
    const correctAnswer = formData.get("trueFalseAnswer") as string;
    if (correctAnswer !== "true" && correctAnswer !== "false") return "Pilih jawaban benar (Benar/Salah).";
    options = [
      { optionText: "Benar", isCorrect: correctAnswer === "true" },
      { optionText: "Salah", isCorrect: correctAnswer === "false" },
    ];
  } else {
    const rawOptions: { optionText: string; isCorrect: boolean }[] = [];
    for (let i = 1; i <= 4; i++) {
      const text = (formData.get(`option${i}`) as string)?.trim();
      if (!text) continue;
      rawOptions.push({ optionText: text, isCorrect: formData.get(`correct${i}`) === "on" });
    }
    if (rawOptions.length < 2) return "Minimal 2 pilihan jawaban wajib diisi.";
    const correctCount = rawOptions.filter((o) => o.isCorrect).length;
    if (correctCount === 0) return "Tandai minimal satu jawaban benar.";
    if (questionType === "SINGLE_CHOICE" && correctCount > 1) {
      return "Pilihan tunggal hanya boleh memiliki satu jawaban benar.";
    }
    options = rawOptions;
  }

  const maxOrder = await prisma.quizQuestion.aggregate({ where: { quizId }, _max: { displayOrder: true } });
  const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

  const question = await prisma.quizQuestion.create({
    data: {
      quizId,
      displayOrder,
      questionText,
      questionType,
      points,
      options: { create: options.map((o, idx) => ({ displayOrder: idx, optionText: o.optionText, isCorrect: o.isCorrect })) },
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "QuizQuestion",
    recordId: question.id,
    reason: `Added question to quiz for course "${quiz.course.title}"`,
  });

  revalidatePath(`/training/courses/${quiz.courseId}`);
}

export async function publishTrainingCourse(courseId: string): Promise<void> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return;

  const course = await prisma.trainingCourse.findUnique({ where: { id: courseId } });
  if (!course || !canPublishCourse(course.status)) return;

  await prisma.trainingCourse.update({ where: { id: courseId }, data: { status: "PUBLISHED" } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TrainingCourse",
    recordId: courseId,
    reason: `Published course "${course.title}"`,
  });

  revalidatePath(`/training/courses/${courseId}`);
  revalidatePath("/training/courses");
}

export async function archiveTrainingCourse(courseId: string): Promise<void> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return;

  const course = await prisma.trainingCourse.findUnique({ where: { id: courseId } });
  if (!course || !canArchiveCourse(course.status)) return;

  await prisma.trainingCourse.update({ where: { id: courseId }, data: { status: "ARCHIVED" } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TrainingCourse",
    recordId: courseId,
    reason: `Archived course "${course.title}"`,
  });

  revalidatePath(`/training/courses/${courseId}`);
  revalidatePath("/training/courses");
}

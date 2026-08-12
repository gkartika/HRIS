"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageTrainingCourse } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// TRN-11/ACC-22: "Training Admin may create courses and sessions manually.
// Creation alone does not enroll anyone" — no learner-facing side effect
// happens here at all.
export async function createTrainingCourse(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTrainingCourse(session)) return "Anda tidak memiliki akses.";

  const title = (formData.get("title") as string)?.trim();
  if (!title) return "Judul pelatihan wajib diisi.";

  const category = (formData.get("category") as string)?.trim() || null;
  const provider = (formData.get("provider") as string)?.trim() || null;
  const deliveryMethod = (formData.get("deliveryMethod") as string)?.trim() || null;
  const plannedCostRaw = (formData.get("plannedCost") as string)?.trim();
  const plannedCost = plannedCostRaw ? Number(plannedCostRaw) : null;
  const certificateRequired = formData.get("certificateRequired") === "on";
  const effectivenessRequired = formData.get("effectivenessRequired") === "on";
  const effectivenessFollowupDaysRaw = (formData.get("effectivenessFollowupDays") as string)?.trim();
  const effectivenessFollowupDays = effectivenessFollowupDaysRaw ? Number(effectivenessFollowupDaysRaw) : 30;

  const course = await prisma.trainingCourse.create({
    data: {
      title,
      category,
      provider,
      deliveryMethod,
      plannedCost,
      certificateRequired,
      effectivenessRequired,
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
  if (!canManageTrainingCourse(session)) return "Anda tidak memiliki akses.";

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

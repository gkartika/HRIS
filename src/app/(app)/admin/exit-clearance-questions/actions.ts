"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageExitClearanceQuestions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PATH = "/admin/exit-clearance-questions";

// Version after UAT: admin-maintained question bank for the employee-facing
// Exit Clearance form — editable here, never by touching code/the database
// directly (same discipline as EducationLevel/PtkpStatus).
export async function createExitClearanceQuestion(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return t("common.forbidden");

  const questionText = (formData.get("questionText") as string)?.trim();
  if (!questionText) return "Pertanyaan wajib diisi.";

  const count = await prisma.exitClearanceQuestion.count();
  const question = await prisma.exitClearanceQuestion.create({
    data: { questionText, displayOrder: count },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ExitClearanceQuestion",
    recordId: question.id,
    reason: `Added exit clearance question "${questionText}"`,
  });

  revalidatePath(PATH);
  redirect(PATH);
}

export async function toggleExitClearanceQuestion(
  questionId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return t("common.forbidden");

  const activeFlag = formData.get("activeFlag") === "on";
  await prisma.exitClearanceQuestion.update({ where: { id: questionId }, data: { activeFlag } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ExitClearanceQuestion",
    recordId: questionId,
    reason: `Set active=${activeFlag}`,
  });

  revalidatePath(PATH);
}

// Swaps displayOrder with the adjacent question — same two-button pattern
// as moveCourseMaterial, no drag-and-drop plumbing needed.
export async function moveExitClearanceQuestion(questionId: string, direction: "up" | "down"): Promise<void> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return;

  const question = await prisma.exitClearanceQuestion.findUnique({ where: { id: questionId } });
  if (!question) return;

  const neighbor = await prisma.exitClearanceQuestion.findFirst({
    where: {
      displayOrder: direction === "up" ? { lt: question.displayOrder } : { gt: question.displayOrder },
    },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.exitClearanceQuestion.update({ where: { id: question.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.exitClearanceQuestion.update({ where: { id: neighbor.id }, data: { displayOrder: question.displayOrder } }),
  ]);

  revalidatePath(PATH);
}

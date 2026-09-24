"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageExitClearanceQuestions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PATH = "/admin/offboarding-reasons";

// Same admin-maintained-list discipline as the Exit Clearance questions:
// add / rename / deactivate / reorder from the screen, never delete (old
// cases keep showing the reason they were opened with).
export async function createOffboardingReason(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Alasan wajib diisi.";
  const existing = await prisma.offboardingReasonOption.findFirst({ where: { label: { equals: label, mode: "insensitive" } } });
  if (existing) return "Alasan ini sudah ada.";

  const count = await prisma.offboardingReasonOption.count();
  const created = await prisma.offboardingReasonOption.create({ data: { label, displayOrder: count } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "OffboardingReasonOption",
    recordId: created.id,
    reason: `Added offboarding reason "${label}"`,
  });
  revalidatePath(PATH);
}

export async function renameOffboardingReason(
  reasonId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Alasan wajib diisi.";
  const duplicate = await prisma.offboardingReasonOption.findFirst({
    where: { label: { equals: label, mode: "insensitive" }, NOT: { id: reasonId } },
  });
  if (duplicate) return "Alasan ini sudah ada.";

  await prisma.offboardingReasonOption.update({ where: { id: reasonId }, data: { label } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingReasonOption",
    recordId: reasonId,
    reason: `Renamed offboarding reason to "${label}"`,
  });
  revalidatePath(PATH);
}

export async function toggleOffboardingReason(reasonId: string, activeFlag: boolean): Promise<void> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return;

  await prisma.offboardingReasonOption.update({ where: { id: reasonId }, data: { activeFlag } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingReasonOption",
    recordId: reasonId,
    reason: `Set active=${activeFlag}`,
  });
  revalidatePath(PATH);
}

export async function moveOffboardingReason(reasonId: string, direction: "up" | "down"): Promise<void> {
  const session = await requireSession();
  if (!canManageExitClearanceQuestions(session)) return;

  const reason = await prisma.offboardingReasonOption.findUnique({ where: { id: reasonId } });
  if (!reason) return;
  const neighbor = await prisma.offboardingReasonOption.findFirst({
    where: { displayOrder: direction === "up" ? { lt: reason.displayOrder } : { gt: reason.displayOrder } },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.offboardingReasonOption.update({ where: { id: reason.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.offboardingReasonOption.update({ where: { id: neighbor.id }, data: { displayOrder: reason.displayOrder } }),
  ]);
  revalidatePath(PATH);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PATH = "/admin/education-levels";

// DM-19: admin-maintained master list for Pendidikan Terakhir — editable
// here, never by touching code/the database directly.
export async function createEducationLevel(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Nama tingkat pendidikan wajib diisi.";

  const existing = await prisma.educationLevel.findUnique({ where: { label } });
  if (existing) return `"${label}" sudah ada dalam daftar.`;

  const count = await prisma.educationLevel.count();
  const level = await prisma.educationLevel.create({
    data: { label, displayOrder: count },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "EducationLevel",
    recordId: level.id,
    reason: `Added education level "${label}"`,
  });

  revalidatePath(PATH);
  redirect(PATH);
}

// Same "editable here, never a code change" discipline as create above —
// e.g. fixing a typo or wording without losing the row's history/links.
export async function renameEducationLevel(
  levelId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Nama tingkat pendidikan wajib diisi.";

  const duplicate = await prisma.educationLevel.findFirst({ where: { label, NOT: { id: levelId } } });
  if (duplicate) return `"${label}" sudah ada dalam daftar.`;

  await prisma.educationLevel.update({ where: { id: levelId }, data: { label } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "EducationLevel",
    recordId: levelId,
    reason: `Renamed to "${label}"`,
  });

  revalidatePath(PATH);
}

export async function toggleEducationLevel(
  levelId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const activeFlag = formData.get("activeFlag") === "on";
  await prisma.educationLevel.update({ where: { id: levelId }, data: { activeFlag } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "EducationLevel",
    recordId: levelId,
    reason: `Set active=${activeFlag}`,
  });

  revalidatePath(PATH);
}

// Swaps displayOrder with the adjacent level — same two-button pattern as
// the Alasan Keluar / Exit Clearance question lists, no drag-and-drop plumbing.
export async function moveEducationLevel(levelId: string, direction: "up" | "down"): Promise<void> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return;

  const level = await prisma.educationLevel.findUnique({ where: { id: levelId } });
  if (!level) return;
  const neighbor = await prisma.educationLevel.findFirst({
    where: { displayOrder: direction === "up" ? { lt: level.displayOrder } : { gt: level.displayOrder } },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.educationLevel.update({ where: { id: level.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.educationLevel.update({ where: { id: neighbor.id }, data: { displayOrder: level.displayOrder } }),
  ]);

  revalidatePath(PATH);
}

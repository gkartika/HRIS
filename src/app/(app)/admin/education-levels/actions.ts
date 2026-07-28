"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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

  revalidatePath("/admin/education-levels");
  redirect("/admin/education-levels");
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

  revalidatePath("/admin/education-levels");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// DM-20: admin-maintained PTKP tax-status codes — editable here so future
// regulatory changes don't require a code change.
export async function createPtkpStatus(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const code = (formData.get("code") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  if (!code || !label) return "Kode dan label PTKP wajib diisi.";

  const existing = await prisma.ptkpStatus.findUnique({ where: { code } });
  if (existing) return `Kode ${code} sudah ada dalam daftar.`;

  const count = await prisma.ptkpStatus.count();
  const status = await prisma.ptkpStatus.create({
    data: { code, label, displayOrder: count },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "PtkpStatus",
    recordId: status.id,
    reason: `Added PTKP status ${code}`,
  });

  revalidatePath("/admin/ptkp-status");
  redirect("/admin/ptkp-status");
}

export async function togglePtkpStatus(
  statusId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const activeFlag = formData.get("activeFlag") === "on";
  await prisma.ptkpStatus.update({ where: { id: statusId }, data: { activeFlag } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "PtkpStatus",
    recordId: statusId,
    reason: `Set active=${activeFlag}`,
  });

  revalidatePath("/admin/ptkp-status");
}

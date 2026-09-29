"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PATH = "/admin/ptkp-status";

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

  revalidatePath(PATH);
  redirect(PATH);
}

// Same "editable here, never a code change" discipline as create above.
// Renaming the code itself is deliberately not offered — Employee.ptkpStatusCode
// points at it directly, so changing the code would silently detach every
// employee already using it; only the label (the human-readable part) is
// editable after creation.
export async function renamePtkpStatus(
  statusId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Label PTKP wajib diisi.";

  await prisma.ptkpStatus.update({ where: { id: statusId }, data: { label } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "PtkpStatus",
    recordId: statusId,
    reason: `Renamed label to "${label}"`,
  });

  revalidatePath(PATH);
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

  revalidatePath(PATH);
}

// Swaps displayOrder with the adjacent status — same two-button pattern used
// throughout these admin-maintained lists.
export async function movePtkpStatus(statusId: string, direction: "up" | "down"): Promise<void> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return;

  const status = await prisma.ptkpStatus.findUnique({ where: { id: statusId } });
  if (!status) return;
  const neighbor = await prisma.ptkpStatus.findFirst({
    where: { displayOrder: direction === "up" ? { lt: status.displayOrder } : { gt: status.displayOrder } },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.ptkpStatus.update({ where: { id: status.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.ptkpStatus.update({ where: { id: neighbor.id }, data: { displayOrder: status.displayOrder } }),
  ]);

  revalidatePath(PATH);
}

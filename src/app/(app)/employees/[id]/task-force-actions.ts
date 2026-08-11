"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageTaskForceMembership } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function addTaskForceMembership(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTaskForceMembership(session)) return "Anda tidak memiliki akses.";

  const name = (formData.get("name") as string)?.trim();
  const roleLabel = (formData.get("roleLabel") as string)?.trim() || null;
  const startDateRaw = formData.get("startDate") as string;

  if (!name) return "Nama Satgas/Task Force wajib diisi.";
  if (!startDateRaw) return "Tanggal mulai wajib diisi.";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const membership = await prisma.taskForceMembership.create({
    data: {
      employeeId,
      name,
      roleLabel,
      startDate: new Date(startDateRaw),
      addedByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "TaskForceMembership",
    recordId: membership.id,
    reason: `Added to task force "${name}"${roleLabel ? ` as ${roleLabel}` : ""}`,
  });

  revalidatePath(`/employees/${employeeId}`);
}

export async function endTaskForceMembership(
  membershipId: string,
  _prevState: string | undefined
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageTaskForceMembership(session)) return "Anda tidak memiliki akses.";

  const membership = await prisma.taskForceMembership.findUnique({ where: { id: membershipId } });
  if (!membership) return "Keanggotaan tidak ditemukan.";
  if (membership.endDate) return "Keanggotaan ini sudah berakhir.";

  await prisma.taskForceMembership.update({
    where: { id: membershipId },
    data: { endDate: new Date() },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TaskForceMembership",
    recordId: membershipId,
    reason: `Ended task force membership "${membership.name}"`,
  });

  revalidatePath(`/employees/${membership.employeeId}`);
}

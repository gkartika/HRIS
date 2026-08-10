"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAccountHold } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { logAudit } from "@/lib/audit";

export async function putAccountOnHold(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canManageAccountHold(session, hrManagerPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses.";
  }
  if (session.user.employeeId === employeeId) {
    return "Anda tidak dapat menahan akun Anda sendiri.";
  }

  const account = await prisma.account.findUnique({ where: { employeeId } });
  if (!account) return "Karyawan ini tidak memiliki akun login.";
  if (account.accountStatus === "DISABLED") return "Akun ini sudah ditahan.";

  const reason = (formData.get("holdReason") as string)?.trim();
  if (!reason) return "Alasan penahanan akun wajib diisi.";

  await prisma.account.update({
    where: { id: account.id },
    data: { accountStatus: "DISABLED", accountDisabledAt: new Date() },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Account",
    recordId: account.id,
    reason: `Account put on hold: ${reason}`,
  });

  revalidatePath(`/employees/${employeeId}`);
}

export async function reactivateAccount(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canManageAccountHold(session, hrManagerPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses.";
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { activeFlag: true } });
  if (!employee) return "Karyawan tidak ditemukan.";
  if (!employee.activeFlag) {
    return "Karyawan ini sudah tidak aktif (Offboarding selesai) — akun tidak dapat diaktifkan kembali dari sini.";
  }

  const account = await prisma.account.findUnique({ where: { employeeId } });
  if (!account) return "Karyawan ini tidak memiliki akun login.";
  if (account.accountStatus === "ACTIVE") return "Akun ini sudah aktif.";

  const note = (formData.get("reactivateNote") as string)?.trim() || null;

  await prisma.account.update({
    where: { id: account.id },
    data: { accountStatus: "ACTIVE", accountDisabledAt: null, failedLoginCount: 0 },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Account",
    recordId: account.id,
    reason: note ? `Account reactivated: ${note}` : "Account reactivated",
  });

  revalidatePath(`/employees/${employeeId}`);
}

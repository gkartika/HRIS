"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAccountAccess, canManageAccountHold } from "@/lib/permissions";
import { inviteEmployee } from "@/lib/account-access";
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
    return t("common.forbidden");
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
    return t("common.forbidden");
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

export type AccountLinkResult = { ok: boolean; message: string } | undefined;

// Admin SDM: create the login (if none) and email the invitation, or a
// password-reset link to an existing account. The employee chooses the
// password themselves — Admin SDM never sees or sets it.
export async function sendAccountLink(
  employeeId: string,
  _prevState: AccountLinkResult,
  _formData: FormData
): Promise<AccountLinkResult> {
  const session = await requireSession();
  if (!canManageAccountAccess(session)) return { ok: false, message: t("common.forbidden") };

  const result = await inviteEmployee(employeeId, session.user.id);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return {
    ok: true,
    message: result.kind === "INVITE" ? "Undangan terkirim ke email karyawan." : "Tautan atur ulang kata sandi terkirim.",
  };
}

const MAX_INVITES_PER_CLICK = 40;

// "Undang semua yang belum punya akun". Capped per click so one request stays
// well inside the server time limit; the message says how many are left.
export async function inviteAllWithoutAccount(): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  if (!canManageAccountAccess(session)) return { ok: false, message: t("common.forbidden") };

  const candidates = await prisma.employee.findMany({
    where: { activeFlag: true, account: { is: null }, personalEmail: { not: null } },
    select: { id: true, personalEmail: true },
    orderBy: { employeeNumber: "asc" },
  });
  const withEmail = candidates.filter((e) => e.personalEmail?.trim());
  const withoutEmail = await prisma.employee.count({
    where: { activeFlag: true, account: { is: null }, OR: [{ personalEmail: null }, { personalEmail: "" }] },
  });
  if (withEmail.length === 0) {
    return {
      ok: withoutEmail === 0,
      message:
        withoutEmail === 0
          ? "Semua karyawan aktif sudah punya akun."
          : `Tidak ada yang bisa diundang: ${withoutEmail} karyawan belum punya Email Pribadi.`,
    };
  }

  const batch = withEmail.slice(0, MAX_INVITES_PER_CLICK);
  let sent = 0;
  let failed = 0;
  for (const employee of batch) {
    const result = await inviteEmployee(employee.id, session.user.id);
    if (result.ok) sent++;
    else failed++;
  }

  revalidatePath("/employees");
  const remaining = withEmail.length - batch.length;
  const parts = [`${sent} undangan terkirim`];
  if (failed) parts.push(`${failed} gagal`);
  if (remaining) parts.push(`${remaining} lagi belum — tekan tombol lagi`);
  if (withoutEmail) parts.push(`${withoutEmail} belum punya Email Pribadi`);
  return { ok: failed === 0, message: parts.join(" · ") + "." };
}

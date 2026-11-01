"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { canManageAccountAccess } from "@/lib/permissions";
import { inviteProductionAdmin, sendProductionAdminLink } from "@/lib/account-access";
import { t } from "@/lib/i18n/id";

export type LinkResult = { ok: boolean; message: string };

// Only Admin SDM creates and manages these logins, and only the stand-alone Admin Produksi
// ones (no employee record behind them) are touched here.
async function guard() {
  const session = await requireSession();
  return canManageAccountAccess(session) ? session : null;
}

async function loadProductionAdminAccount(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { roles: true } });
  const ok = !!account && account.accountType === "ADMIN" && account.employeeId === null && account.roles.some((r) => r.role === "PRODUCTION_ADMIN");
  return ok ? account : null;
}

export async function addProductionAdminAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await guard();
  if (!session) return t("common.forbidden");
  const res = await inviteProductionAdmin((formData.get("email") as string) ?? "", session.user.id);
  revalidatePath("/admin/production-admins");
  return res.ok ? undefined : res.error;
}

export async function sendProductionAdminLinkAction(accountId: string): Promise<LinkResult> {
  const session = await guard();
  if (!session) return { ok: false, message: t("common.forbidden") };
  const res = await sendProductionAdminLink(accountId, session.user.id);
  revalidatePath("/admin/production-admins");
  return res.ok
    ? { ok: true, message: res.kind === "INVITE" ? "Undangan terkirim." : "Tautan atur ulang kata sandi terkirim." }
    : { ok: false, message: res.error };
}

export async function holdProductionAdminAction(accountId: string): Promise<string | undefined> {
  const session = await guard();
  if (!session) return t("common.forbidden");
  const account = await loadProductionAdminAccount(accountId);
  if (!account) return "Akun tidak ditemukan.";
  if (account.accountStatus === "DISABLED") return "Akun ini sudah ditahan.";
  await prisma.account.update({ where: { id: accountId }, data: { accountStatus: "DISABLED", accountDisabledAt: new Date() } });
  await logAudit({ actorAccountId: session.user.id, action: "UPDATE", datasetName: "Account", recordId: accountId, reason: "Production Department account put on hold" });
  revalidatePath("/admin/production-admins");
}

export async function reactivateProductionAdminAction(accountId: string): Promise<string | undefined> {
  const session = await guard();
  if (!session) return t("common.forbidden");
  const account = await loadProductionAdminAccount(accountId);
  if (!account) return "Akun tidak ditemukan.";
  if (account.accountStatus !== "DISABLED") return "Akun ini tidak sedang ditahan.";
  // Someone who never set a password goes back to "invited"; otherwise straight to active.
  await prisma.account.update({
    where: { id: accountId },
    data: { accountStatus: account.lastLoginAt ? "ACTIVE" : "INVITED", accountDisabledAt: null, failedLoginCount: 0 },
  });
  await logAudit({ actorAccountId: session.user.id, action: "UPDATE", datasetName: "Account", recordId: accountId, reason: "Production Department account reactivated" });
  revalidatePath("/admin/production-admins");
}

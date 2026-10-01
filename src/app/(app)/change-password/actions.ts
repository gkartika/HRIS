"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { logAudit } from "@/lib/audit";
import { validatePassword } from "@/lib/password";
import { formFail, type FormState } from "@/lib/form-state";

export type ChangePasswordState = FormState | { error: ""; done: true; values: Record<string, string> };

// Signed-in users changing their own password: needs the current one, so a
// borrowed, unlocked screen can't be used to take over the account.
export async function changeOwnPassword(_prevState: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await requireSession();
  const current = (formData.get("current") as string) ?? "";
  const next = (formData.get("next") as string) ?? "";
  const confirm = (formData.get("confirm") as string) ?? "";

  const account = await prisma.account.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!account || !(await bcrypt.compare(current, account.passwordHash))) {
    return { error: "Kata sandi saat ini salah.", field: "current", values: {} };
  }
  const nextError = validatePassword(next);
  if (nextError) return { error: nextError, field: "next", values: {} };
  if (next !== confirm) return { error: "Kedua kata sandi baru tidak sama.", field: "confirm", values: {} };
  if (next === current) return formFail(formData, "Kata sandi baru harus berbeda dari yang lama.");

  await prisma.account.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(next, 10), passwordResetRequired: false },
  });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Account",
    recordId: session.user.id,
    reason: "Password changed by the account owner",
  });
  return { error: "", done: true, values: {} };
}

// Signed-in users changing their own login email/username — same
// current-password requirement as changeOwnPassword, for the same reason.
export async function changeOwnLoginEmail(_prevState: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await requireSession();
  const currentPassword = (formData.get("currentPassword") as string) ?? "";
  const newEmail = ((formData.get("newEmail") as string) ?? "").trim();

  const account = await prisma.account.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, usernameOrEmail: true },
  });
  if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) {
    return formFail(formData, "Kata sandi saat ini salah.", "currentPassword");
  }
  if (!newEmail) return formFail(formData, "Email/username baru wajib diisi.", "newEmail");
  if (newEmail.toLowerCase() === account.usernameOrEmail.toLowerCase()) {
    return formFail(formData, "Email/username baru harus berbeda dari yang lama.", "newEmail");
  }
  const taken = await prisma.account.findFirst({
    where: { usernameOrEmail: { equals: newEmail, mode: "insensitive" } },
  });
  if (taken) return formFail(formData, `"${newEmail}" sudah dipakai akun lain.`, "newEmail");

  await prisma.account.update({ where: { id: session.user.id }, data: { usernameOrEmail: newEmail } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Account",
    recordId: session.user.id,
    reason: `Login email changed from ${account.usernameOrEmail} to ${newEmail} by the account owner`,
  });
  return { error: "", done: true, values: {} };
}

"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { findUsableToken } from "@/lib/account-tokens";
import { validatePassword } from "@/lib/password";
import { formFail, type FormState } from "@/lib/form-state";

// Completes an invitation or a reset: the link's token is the only credential.
// Works once; also opens a locked account and activates an invited one.
export async function setPasswordWithToken(token: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const password = (formData.get("password") as string) ?? "";
  const confirm = (formData.get("confirm") as string) ?? "";

  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError, field: "password", values: {} };
  if (password !== confirm) return { error: "Kedua kata sandi tidak sama.", field: "confirm", values: {} };

  const usable = await findUsableToken(token);
  if (!usable) return formFail(formData, 'Tautan ini sudah tidak berlaku. Minta tautan baru lewat "Lupa kata sandi".');
  if (usable.account.accountStatus === "DISABLED") {
    return formFail(formData, "Akun ini sedang ditahan. Hubungi Admin SDM.");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.account.update({
      where: { id: usable.accountId },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        accountStatus: "ACTIVE",
        failedLoginCount: 0,
        passwordResetRequired: false,
      },
    }),
    prisma.accountToken.updateMany({ where: { accountId: usable.accountId, usedAt: null }, data: { usedAt: now } }),
  ]);
  await logAudit({
    actorAccountId: usable.accountId,
    action: "UPDATE",
    datasetName: "Account",
    recordId: usable.accountId,
    reason: usable.purpose === "INVITE" ? "Password created from invitation" : "Password reset from emailed link",
  });

  redirect("/login?done=1");
}

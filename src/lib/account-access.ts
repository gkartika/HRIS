import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { appBaseUrl, sendMail } from "@/lib/mailer";
import { createAccountToken, recentlyIssuedToken, TOKEN_TTL_MS } from "@/lib/account-tokens";
import type { AccountTokenPurpose } from "@/generated/prisma/enums";

// Everything that hands an employee a "create / reset your password" link.
// Used by the Admin SDM buttons (invite, resend, reset) and by the public
// "Lupa kata sandi" form. None of this is a server action — the callers
// (which check who is asking) are.

function linkEmail(kind: AccountTokenPurpose, name: string, url: string) {
  const days = TOKEN_TTL_MS[kind] / (24 * 60 * 60 * 1000);
  const validity = days >= 2 ? `${days} hari` : "24 jam";
  const invite = kind === "INVITE";
  const subject = invite ? "Undangan akun SAPA" : "Atur ulang kata sandi SAPA";
  const lead = invite
    ? "Admin SDM sudah menyiapkan akun SAPA untuk Anda. Klik tautan di bawah untuk membuat kata sandi."
    : "Kami menerima permintaan untuk mengatur ulang kata sandi akun SAPA Anda. Klik tautan di bawah untuk membuat kata sandi baru.";
  const action = invite ? "Buat kata sandi" : "Atur ulang kata sandi";
  const footer = `Tautan berlaku ${validity} dan hanya bisa dipakai sekali. ${
    invite ? "Jika Anda tidak merasa perlu akun ini, abaikan email ini." : "Jika Anda tidak memintanya, abaikan email ini — kata sandi Anda tidak berubah."
  }`;
  const text = `Halo ${name},\n\n${lead}\n\n${url}\n\n${footer}\n`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1c2033">
<p>Halo ${escapeHtml(name)},</p><p>${lead}</p>
<p><a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${action}</a></p>
<p style="color:#5d647d;font-size:12px">Atau salin tautan ini ke peramban Anda:<br>${url}</p>
<p style="color:#5d647d;font-size:12px">${footer}</p></div>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

async function sendLink(account: { id: string }, toEmail: string, name: string, kind: AccountTokenPurpose) {
  const rawToken = await createAccountToken(account.id, kind);
  const url = `${appBaseUrl()}/set-password?token=${rawToken}`;
  await sendMail({ to: toEmail, ...linkEmail(kind, name, url) });
}

export type InviteResult = { ok: true; kind: "INVITE" | "RESET" } | { ok: false; error: string };

// Admin SDM: create the login for an employee if there is none, then email the
// link. Login name = the employee's personal email (answer 2). An account that
// is still waiting for its first password gets a fresh invitation; an active
// or locked one gets a reset link.
export async function inviteEmployee(employeeId: string, actorAccountId: string): Promise<InviteResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, fullLegalName: true, personalEmail: true, activeFlag: true, account: true },
  });
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };
  if (!employee.activeFlag) return { ok: false, error: "Karyawan ini sudah tidak aktif." };

  const email = employee.personalEmail?.trim().toLowerCase();
  if (!email) return { ok: false, error: "Isi Email Pribadi karyawan ini dulu (Ubah Data Karyawan)." };

  let account = employee.account;
  if (account?.accountStatus === "DISABLED") {
    return { ok: false, error: "Akun ini sedang ditahan. Aktifkan kembali dulu sebelum mengirim tautan." };
  }

  if (!account) {
    const taken = await prisma.account.findFirst({ where: { usernameOrEmail: { equals: email, mode: "insensitive" } } });
    if (taken) return { ok: false, error: "Email ini sudah dipakai akun lain." };
    account = await prisma.account.create({
      data: {
        usernameOrEmail: email,
        // No password exists until the employee sets one; this random hash can't be guessed or logged in with.
        passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
        accountType: "EMPLOYEE_LOGIN",
        employeeId: employee.id,
        accountStatus: "INVITED",
        roles: { create: { role: "EMPLOYEE" } },
      },
    });
    await logAudit({
      actorAccountId,
      action: "CREATE",
      datasetName: "Account",
      recordId: account.id,
      reason: `Login account created for ${employee.fullLegalName} (invitation)`,
    });
  } else if (account.usernameOrEmail.toLowerCase() !== email && account.accountStatus === "INVITED") {
    // The email was corrected after the invitation went out — follow it.
    await prisma.account.update({ where: { id: account.id }, data: { usernameOrEmail: email } });
  }

  const kind: AccountTokenPurpose = account.accountStatus === "INVITED" ? "INVITE" : "RESET";
  try {
    await sendLink(account, email, employee.fullLegalName, kind);
  } catch (error) {
    console.error("sendLink failed", error);
    return { ok: false, error: "Email gagal dikirim. Periksa pengaturan email lalu coba lagi." };
  }
  await logAudit({
    actorAccountId,
    action: "UPDATE",
    datasetName: "Account",
    recordId: account.id,
    reason: kind === "INVITE" ? "Invitation email sent" : "Password reset link sent by Admin SDM",
  });
  return { ok: true, kind };
}

// Public "Lupa kata sandi": the caller always shows the same neutral message,
// whether or not this finds anyone (so the form can't be used to discover who
// has an account). Returns quietly on every non-send path.
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return;

  const account = await prisma.account.findFirst({
    where: { usernameOrEmail: { equals: email, mode: "insensitive" } },
    include: { employee: { select: { fullLegalName: true, personalEmail: true } } },
  });
  if (!account || account.accountStatus === "DISABLED") return;
  if (await recentlyIssuedToken(account.id)) return;

  const toEmail = account.usernameOrEmail.includes("@") ? account.usernameOrEmail : account.employee?.personalEmail;
  if (!toEmail) return;

  const kind: AccountTokenPurpose = account.accountStatus === "INVITED" ? "INVITE" : "RESET";
  try {
    await sendLink(account, toEmail, account.employee?.fullLegalName ?? account.usernameOrEmail, kind);
    await logAudit({
      actorAccountId: account.id,
      action: "UPDATE",
      datasetName: "Account",
      recordId: account.id,
      reason: "Password reset link requested and sent",
    });
  } catch (error) {
    console.error("requestPasswordReset: email failed", error);
  }
}

// A stand-alone login for the person who runs the applicant pipeline (Admin Rekrutmen): no
// employee record behind it, like the Admin SDM login. Admin SDM creates it by email; the
// person sets their own password from the emailed link.
function isRecruitmentAdminAccount(account: { accountType: string; employeeId: string | null; roles: { role: string }[] }): boolean {
  return account.accountType === "ADMIN" && account.employeeId === null && account.roles.some((r) => r.role === "RECRUITMENT_ADMIN");
}

export async function inviteRecruitmentAdmin(emailInput: string, actorAccountId: string): Promise<InviteResult> {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Alamat email tidak valid." };

  const existing = await prisma.account.findFirst({
    where: { usernameOrEmail: { equals: email, mode: "insensitive" } },
    include: { roles: true },
  });
  if (existing) {
    if (!isRecruitmentAdminAccount(existing)) return { ok: false, error: "Email ini sudah dipakai akun lain." };
    return sendRecruitmentAdminLink(existing.id, actorAccountId);
  }

  const account = await prisma.account.create({
    data: {
      usernameOrEmail: email,
      // No password exists until the person sets one; this random hash can't be logged in with.
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      accountType: "ADMIN",
      adminScope: "NONE",
      accountStatus: "INVITED",
      roles: { create: { role: "RECRUITMENT_ADMIN" } },
    },
  });
  await logAudit({
    actorAccountId,
    action: "CREATE",
    datasetName: "Account",
    recordId: account.id,
    reason: `Admin Rekrutmen login created for ${email} (invitation)`,
  });
  return sendRecruitmentAdminLink(account.id, actorAccountId);
}

export async function sendRecruitmentAdminLink(accountId: string, actorAccountId: string): Promise<InviteResult> {
  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { roles: true } });
  if (!account || !isRecruitmentAdminAccount(account)) return { ok: false, error: "Akun tidak ditemukan." };
  if (account.accountStatus === "DISABLED") return { ok: false, error: "Akun ini sedang ditahan. Aktifkan kembali dulu sebelum mengirim tautan." };

  const kind: AccountTokenPurpose = account.accountStatus === "INVITED" ? "INVITE" : "RESET";
  try {
    await sendLink(account, account.usernameOrEmail, account.usernameOrEmail, kind);
  } catch (error) {
    console.error("sendRecruitmentAdminLink failed", error);
    return { ok: false, error: "Email gagal dikirim. Periksa pengaturan email lalu coba lagi." };
  }
  await logAudit({
    actorAccountId,
    action: "UPDATE",
    datasetName: "Account",
    recordId: account.id,
    reason: kind === "INVITE" ? "Invitation email sent" : "Password reset link sent by Admin SDM",
  });
  return { ok: true, kind };
}

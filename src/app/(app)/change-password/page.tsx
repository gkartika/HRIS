import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeEmailForm } from "./change-email-form";

export default async function ChangePasswordPage() {
  const session = await requireSession();
  const account = await prisma.account.findUnique({
    where: { id: session.user.id },
    select: { usernameOrEmail: true, lastLoginAt: true },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Ganti Kata Sandi</h1>
      <p className="mt-1 mb-5 text-sm text-slate-500">
        Akun: {account?.usernameOrEmail}
        {account?.lastLoginAt && (
          <>
            {" "}
            · Masuk terakhir:{" "}
            {new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(
              account.lastLoginAt
            )}{" "}
            WIB
          </>
        )}
      </p>
      <ChangePasswordForm />

      <h2 className="mt-8 mb-1 text-sm font-medium text-slate-900">Ubah Email Login</h2>
      <p className="mt-1 mb-5 text-sm text-slate-500">Email ini juga dipakai untuk menerima tautan undangan/reset kata sandi.</p>
      <ChangeEmailForm currentEmail={account?.usernameOrEmail ?? ""} />
    </div>
  );
}

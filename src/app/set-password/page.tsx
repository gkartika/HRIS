import Link from "next/link";
import { findUsableToken } from "@/lib/account-tokens";
import { t } from "@/lib/i18n/id";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const usable = await findUsableToken(token);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{t("app.company")}</p>
        <p className="text-xl font-semibold text-slate-900">{t("app.name")}</p>
      </div>
      {usable ? (
        <SetPasswordForm token={token} email={usable.account.usernameOrEmail} />
      ) : (
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-medium text-slate-900">Tautan tidak berlaku</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tautan ini sudah dipakai atau kedaluwarsa. Minta tautan baru untuk membuat kata sandi.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Minta tautan baru
          </Link>
        </div>
      )}
    </div>
  );
}

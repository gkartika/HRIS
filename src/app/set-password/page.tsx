import Link from "next/link";
import { findUsableToken } from "@/lib/account-tokens";
import { AuthShell, authButtonClass } from "@/components/auth-shell";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const usable = await findUsableToken(token);

  return (
    <AuthShell>
      {usable ? (
        <SetPasswordForm token={token} email={usable.account.usernameOrEmail} />
      ) : (
        <div>
          <h1 className="mt-6 text-3xl font-extrabold text-[#231a28]">Tautan tidak berlaku</h1>
          <p className="mt-1.5 text-[14.5px] text-[#6a5f72]">
            Tautan ini sudah dipakai atau kedaluwarsa. Minta tautan baru untuk membuat kata sandi.
          </p>
          <Link href="/forgot-password" className={`${authButtonClass} mt-6 block text-center`}>
            Minta tautan baru
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

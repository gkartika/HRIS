"use client";

import { useActionState, useEffect, useState } from "react";
import { loginAction } from "./actions";
import Link from "next/link";
import { t } from "@/lib/i18n/id";
import { clearAppBadge } from "@/lib/app-badge";
import { InstallAppButton } from "@/components/install-app-button";
import { authButtonClass, authInputClass, authLabelClass, authLinkClass } from "@/components/auth-styles";
import { useAuthMood } from "@/components/auth-stage";

export function LoginForm({ notice, saved = false }: { notice?: string; saved?: boolean }) {
  const [error, formAction, isPending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const { setMood } = useAuthMood();

  // The mascot follows what is happening: thinking while signing in, worried after a wrong password,
  // happy after a new password was saved.
  useEffect(() => {
    if (isPending) setMood("normal", t("auth.mascot.loading"));
    else if (error) setMood("oops", t("auth.mascot.loginError"));
    else if (saved) setMood("happy", t("auth.mascot.saved"));
    else setMood("normal");
  }, [isPending, error, saved, setMood]);

  // Nobody is signed in here, so no approvals can be waiting for them.
  useEffect(() => {
    void clearAppBadge();
  }, []);

  return (
    <div>
      <h1 className="mt-1 text-3xl font-extrabold text-[#231a28]">{t("auth.welcome")}</h1>
      <p className="mt-1.5 text-[14.5px] text-[#6a5f72]">{t("auth.loginSubtitle")}</p>

      {notice && (
        <p role="status" className="mt-4 rounded-[10px] border border-[#bfe0cd] bg-[#e6f4ec] px-3 py-2.5 text-[13.5px] text-[#1d6b43]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
          {t("auth.loginError")}
        </p>
      )}
      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label className={authLabelClass} htmlFor="usernameOrEmail">
            {t("auth.usernameLabel")}
          </label>
          <input
            id="usernameOrEmail"
            name="usernameOrEmail"
            type="text"
            required
            autoFocus
            autoComplete="username"
            placeholder="nama@ptcbp.com"
            className={authInputClass}
          />
        </div>
        <div>
          <label className={authLabelClass} htmlFor="password">
            {t("auth.passwordLabel")}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Kata sandi Anda"
              className={`${authInputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#6a5f72] hover:text-brand"
            >
              {showPassword ? "Sembunyikan" : "Lihat"}
            </button>
          </div>
        </div>
        <button type="submit" disabled={isPending} className={`${authButtonClass} mt-2`}>
          {isPending ? t("common.loading") : t("auth.loginButton")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className={authLinkClass}>
          Lupa kata sandi?
        </Link>
      </p>
      <div className="flex justify-center">
        <InstallAppButton />
      </div>
    </div>
  );
}

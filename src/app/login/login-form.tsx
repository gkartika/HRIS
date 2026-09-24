"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import Link from "next/link";
import { t } from "@/lib/i18n/id";

export function LoginForm({ notice }: { notice?: string }) {
  const [error, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("auth.loginSubtitle")}</p>

        {notice && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="usernameOrEmail">
              {t("auth.usernameLabel")}
            </label>
            <input
              id="usernameOrEmail"
              name="usernameOrEmail"
              type="text"
              required
              autoFocus
              autoComplete="username"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="password">
              {t("auth.passwordLabel")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-rose-600">{t("auth.loginError")}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPending ? t("common.loading") : t("auth.loginButton")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-indigo-600 hover:underline">
            Lupa kata sandi?
          </Link>
        </p>
      </div>
    </div>
  );
}

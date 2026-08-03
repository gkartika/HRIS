"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { t } from "@/lib/i18n/id";

const DEMO_ACCOUNTS = [
  { role: "roles.HR_ADMIN", user: "hr.admin@cbp.demo" },
  { role: "roles.TRAINING_ADMIN", user: "training.admin@cbp.demo" },
  { role: "roles.GA_ADMIN", user: "ga.admin@cbp.demo" },
  { role: "roles.MANAGER", user: "budi.manager@cbp.demo" },
  { role: "roles.EMPLOYEE", user: "siti.karyawan@cbp.demo" },
  { role: "roles.HR_MANAGER", user: "made.wirawan@cbp.demo" },
];

const DEMO_PASSWORD = "Demo12345!";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("auth.loginSubtitle")}</p>

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
              defaultValue="hr.admin@cbp.demo"
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
              defaultValue={DEMO_PASSWORD}
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
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-900">{t("auth.demoAccountsTitle")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Kata sandi semua akun demo: <code className="font-mono">{DEMO_PASSWORD}</code>
        </p>
        <div className="mt-4 space-y-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <div
              key={acc.user}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="text-slate-600">{t(acc.role)}</span>
              <code className="font-mono text-xs text-indigo-600">{acc.user}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

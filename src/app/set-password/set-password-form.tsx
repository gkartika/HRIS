"use client";

import { useActionState, useState } from "react";
import { setPasswordWithToken } from "./actions";
import { checkPassword } from "@/lib/password";
import { FieldError, invalidClass } from "@/components/field-error";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(setPasswordWithToken.bind(null, token), undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const check = checkPassword(password);
  const same = password.length > 0 && password === confirm;
  const ready = check.longEnough && check.hasLetterAndDigit && same;
  const rule = (ok: boolean) => (ok ? "text-emerald-600" : "text-slate-500");
  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-medium text-slate-900">Buat kata sandi</h1>
      <p className="mt-1 text-sm text-slate-500">Untuk akun {email}</p>
      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-xs text-slate-500">
            Kata sandi baru
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${input} ${invalidClass(state, "password")}`}
          />
          <FieldError state={state} name="password" />
          <ul className="mt-2 space-y-0.5 text-xs">
            <li className={rule(check.longEnough)}>{check.longEnough ? "●" : "○"} Minimal 8 karakter</li>
            <li className={rule(check.hasLetterAndDigit)}>{check.hasLetterAndDigit ? "●" : "○"} Ada huruf dan angka</li>
            <li className={rule(same)}>{same ? "●" : "○"} Sama dengan kolom ulangi</li>
          </ul>
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1 block text-xs text-slate-500">
            Ulangi kata sandi
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${input} ${invalidClass(state, "confirm")}`}
          />
          <FieldError state={state} name="confirm" />
        </div>
        {state && !state.field && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending || !ready}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Simpan dan masuk"}
        </button>
      </form>
    </div>
  );
}

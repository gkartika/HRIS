"use client";

import { useActionState, useState } from "react";
import { setPasswordWithToken } from "./actions";
import { checkPassword } from "@/lib/password";
import { FieldError, invalidClass } from "@/components/field-error";
import { authButtonClass, authInputClass, authLabelClass } from "@/components/auth-styles";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(setPasswordWithToken.bind(null, token), undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const check = checkPassword(password);
  const same = password.length > 0 && password === confirm;
  const ready = check.longEnough && check.hasLetterAndDigit && same;
  const rule = (ok: boolean) => (ok ? "text-emerald-600" : "text-[#6a5f72]");

  return (
    <div>
      <h1 className="mt-1 text-3xl font-extrabold text-[#231a28]">Buat kata sandi</h1>
      <p className="mt-1.5 text-[14.5px] text-[#6a5f72]">Untuk akun {email}</p>
      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label htmlFor="password" className={authLabelClass}>
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
            className={`${authInputClass} ${invalidClass(state, "password")}`}
          />
          <FieldError state={state} name="password" />
          <ul className="mt-2 space-y-0.5 text-xs">
            <li className={rule(check.longEnough)}>{check.longEnough ? "●" : "○"} Minimal 8 karakter</li>
            <li className={rule(check.hasLetterAndDigit)}>{check.hasLetterAndDigit ? "●" : "○"} Ada huruf dan angka</li>
            <li className={rule(same)}>{same ? "●" : "○"} Sama dengan kolom ulangi</li>
          </ul>
        </div>
        <div>
          <label htmlFor="confirm" className={authLabelClass}>
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
            className={`${authInputClass} ${invalidClass(state, "confirm")}`}
          />
          <FieldError state={state} name="confirm" />
        </div>
        {state && !state.field && (
          <p role="alert" className="rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={isPending || !ready} className={`${authButtonClass} mt-2`}>
          {isPending ? "Menyimpan..." : "Simpan dan masuk"}
        </button>
      </form>
    </div>
  );
}

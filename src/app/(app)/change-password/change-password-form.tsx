"use client";

import { useActionState, useRef } from "react";
import { changeOwnPassword, type ChangePasswordState } from "./actions";
import { FieldError, invalidClass } from "@/components/field-error";

export function ChangePasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    async (prev: ChangePasswordState, formData: FormData) => {
      const result = await changeOwnPassword(prev, formData);
      if (result && "done" in result) ref.current?.reset();
      return result;
    },
    undefined
  );
  const done = !!state && "done" in state;
  const failure = state && !("done" in state) ? state : undefined;
  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  return (
    <form ref={ref} action={formAction} className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="current" className="mb-1 block text-xs text-slate-500">
          Kata sandi saat ini
        </label>
        <input id="current" name="current" type="password" required autoComplete="current-password" className={`${input} ${invalidClass(failure, "current")}`} />
        <FieldError state={failure} name="current" />
      </div>
      <div>
        <label htmlFor="next" className="mb-1 block text-xs text-slate-500">
          Kata sandi baru
        </label>
        <input id="next" name="next" type="password" required autoComplete="new-password" className={`${input} ${invalidClass(failure, "next")}`} />
        <FieldError state={failure} name="next" />
        <p className="mt-1 text-xs text-slate-500">Minimal 8 karakter, ada huruf dan angka.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-xs text-slate-500">
          Ulangi kata sandi baru
        </label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={`${input} ${invalidClass(failure, "confirm")}`} />
        <FieldError state={failure} name="confirm" />
      </div>
      {failure && !failure.field && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {failure.error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Kata sandi berhasil diganti.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Ganti kata sandi"}
      </button>
    </form>
  );
}

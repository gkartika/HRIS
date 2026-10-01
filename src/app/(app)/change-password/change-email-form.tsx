"use client";

import { useActionState, useRef } from "react";
import { changeOwnLoginEmail, type ChangePasswordState } from "./actions";
import { FieldError, invalidClass } from "@/components/field-error";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    async (prev: ChangePasswordState, formData: FormData) => {
      const result = await changeOwnLoginEmail(prev, formData);
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
        <label htmlFor="newEmail" className="mb-1 block text-xs text-slate-500">
          Email login baru
        </label>
        <input
          id="newEmail"
          name="newEmail"
          type="text"
          required
          defaultValue={failure?.values.newEmail ?? ""}
          placeholder={currentEmail}
          className={`${input} ${invalidClass(failure, "newEmail")}`}
        />
        <FieldError state={failure} name="newEmail" />
      </div>
      <div>
        <label htmlFor="currentPassword" className="mb-1 block text-xs text-slate-500">
          Kata sandi saat ini
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={`${input} ${invalidClass(failure, "currentPassword")}`}
        />
        <FieldError state={failure} name="currentPassword" />
      </div>
      {failure && !failure.field && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {failure.error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Email login berhasil diganti. Gunakan email baru untuk masuk lain kali.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Ganti email login"}
      </button>
    </form>
  );
}

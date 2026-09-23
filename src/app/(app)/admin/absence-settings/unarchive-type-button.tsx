"use client";

import { useActionState } from "react";
import { unarchiveAbsenceTypeConfig } from "./actions";

export function UnarchiveTypeButton({ code }: { code: string }) {
  const action = unarchiveAbsenceTypeConfig.bind(null, code);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-indigo-600 hover:underline disabled:opacity-60">
        {isPending ? "…" : "Batalkan Arsip"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </form>
  );
}

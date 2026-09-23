"use client";

import { useActionState } from "react";
import { deleteCompanyHoliday } from "./holiday-actions";

export function DeleteHolidayButton({ id }: { id: string }) {
  const action = deleteCompanyHoliday.bind(null, id);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-rose-600 hover:underline disabled:opacity-60">
        {isPending ? "…" : "Hapus"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </form>
  );
}

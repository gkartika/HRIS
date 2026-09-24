"use client";

import { useActionState } from "react";
import { deleteCompanyHoliday } from "./holiday-actions";
import { ConfirmButton } from "@/components/confirm-button";

export function DeleteHolidayButton({ id }: { id: string }) {
  const action = deleteCompanyHoliday.bind(null, id);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline">
      <ConfirmButton label="Hapus" pending={isPending} className="text-xs text-rose-600 hover:underline disabled:opacity-60" />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </form>
  );
}

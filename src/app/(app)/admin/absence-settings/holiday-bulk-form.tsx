"use client";

import { useActionState } from "react";
import { addCompanyHolidays } from "./holiday-actions";
import type { HolidayType } from "@/generated/prisma/enums";

export function HolidayBulkForm({ holidayType, title, placeholder }: { holidayType: HolidayType; title: string; placeholder: string }) {
  const action = addCompanyHolidays.bind(null, holidayType);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">Satu tanggal per baris — format: YYYY-MM-DD Nama Libur</p>
      <textarea
        name="lines"
        rows={6}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
      />
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menerapkan…" : "Terapkan"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </form>
  );
}

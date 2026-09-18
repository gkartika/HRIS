"use client";

import { useActionState } from "react";
import { setAbsenceQuotaOverride } from "../../employees/[id]/absence-quota-actions";

export interface QuotaOverrideRow {
  employeeId: string;
  employeeLabel: string;
  absenceTypeCode: string;
  absenceTypeLabel: string;
  annualDays: number;
  updatedAt: string;
}

export function QuotaOverrideRowForm({ row }: { row: QuotaOverrideRow }) {
  const action = setAbsenceQuotaOverride.bind(null, row.employeeId, row.absenceTypeCode);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-3 first:border-t-0">
      <div className="w-56 text-sm text-slate-700">{row.employeeLabel}</div>
      <div className="w-28 text-sm text-slate-600">{row.absenceTypeLabel}</div>
      <input
        name="annualDays"
        type="number"
        min={0}
        defaultValue={row.annualDays}
        placeholder="Kosongkan untuk hapus"
        className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <span className="text-xs text-slate-400">Diubah {row.updatedAt}</span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "..." : "Simpan"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  );
}

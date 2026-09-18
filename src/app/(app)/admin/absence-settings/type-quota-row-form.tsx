"use client";

import { useActionState } from "react";
import { updateAbsenceTypeAndQuota } from "./actions";

export interface AbsenceTypeQuotaRow {
  code: string;
  label: string;
  requiresFirstApproval: boolean;
  activeFlag: boolean;
  annualDays: number | null;
}

export function TypeQuotaRowForm({ row }: { row: AbsenceTypeQuotaRow }) {
  const action = updateAbsenceTypeAndQuota.bind(null, row.code);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 font-mono text-xs text-slate-400">{row.code}</p>
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          name="label"
          defaultValue={row.label}
          required
          className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="requiresFirstApproval" defaultChecked={row.requiresFirstApproval} />
          Perlu Penyetuju Pertama
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="activeFlag" defaultChecked={row.activeFlag} />
          Aktif
        </label>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Jatah Tahunan Default</label>
          <input
            name="annualDays"
            type="number"
            min={0}
            defaultValue={row.annualDays ?? ""}
            placeholder="Tidak dibatasi"
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-slate-400">hari (kosongkan = tidak dibatasi, 0 = benar-benar tidak ada jatah)</span>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "..." : "Simpan"}
        </button>
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </form>
    </div>
  );
}

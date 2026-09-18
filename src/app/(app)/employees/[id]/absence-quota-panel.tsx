"use client";

import { useActionState } from "react";
import { setAbsenceQuotaOverride } from "./absence-quota-actions";

export interface AbsenceQuotaRow {
  code: string;
  label: string;
  defaultAnnualDays: number | null;
  overrideAnnualDays: number | null;
  usedDaysThisYear: number;
}

function QuotaRowForm({ employeeId, row }: { employeeId: string; row: AbsenceQuotaRow }) {
  const action = setAbsenceQuotaOverride.bind(null, employeeId, row.code);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-3 first:border-t-0">
      <div className="w-40 text-sm text-slate-700">{row.label}</div>
      <div className="text-xs text-slate-400">
        Default: {row.defaultAnnualDays !== null ? `${row.defaultAnnualDays} hari` : "Tidak terbatas"}
      </div>
      <div className="text-xs text-slate-400">Terpakai tahun ini: {row.usedDaysThisYear} hari</div>
      <input
        name="annualDays"
        type="number"
        min={0}
        placeholder="Ikuti default"
        defaultValue={row.overrideAnnualDays ?? ""}
        className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
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

export function AbsenceQuotaPanel({ employeeId, rows }: { employeeId: string; rows: AbsenceQuotaRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-medium text-slate-900">Jatah Absensi Tahunan</h2>
      <p className="mt-1 text-xs text-slate-500">
        Kosongkan untuk mengikuti jatah default perusahaan per jenis Absensi. Isi angka untuk mengecualikan karyawan ini
        dari jatah default (mis. menaikkan jatah Cuti untuk kasus tertentu).
      </p>
      <div className="mt-3">
        {rows.map((row) => (
          <QuotaRowForm key={row.code} employeeId={employeeId} row={row} />
        ))}
      </div>
    </div>
  );
}

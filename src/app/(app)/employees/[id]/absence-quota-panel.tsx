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
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="annualDays"
        type="number"
        min={0}
        placeholder="Ikuti default"
        defaultValue={row.overrideAnnualDays ?? ""}
        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
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
    <div>
      <h2 className="text-sm font-medium text-slate-900">Jatah Absensi Tahunan</h2>
      <p className="mt-1 text-xs text-slate-500">
        Kosongkan untuk mengikuti jatah default perusahaan per jenis Absensi. Isi angka untuk mengecualikan karyawan ini
        dari jatah default (mis. menaikkan jatah Cuti untuk kasus tertentu).
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Jenis Absensi</th>
              <th className="px-3 py-2 font-medium">Default</th>
              <th className="px-3 py-2 font-medium">Terpakai Tahun Ini</th>
              <th className="px-3 py-2 font-medium">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.code}>
                <td className="px-3 py-2 text-slate-700">{row.label}</td>
                <td className="px-3 py-2 text-slate-500">
                  {row.defaultAnnualDays !== null ? `${row.defaultAnnualDays} hari` : "Tidak terbatas"}
                </td>
                <td className="px-3 py-2 text-slate-500">{row.usedDaysThisYear} hari</td>
                <td className="px-3 py-2">
                  <QuotaRowForm employeeId={employeeId} row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

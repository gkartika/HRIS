"use client";

import { useActionState } from "react";
import { addAbsenceQuotaOverride } from "./actions";

export interface EmployeeOption {
  id: string;
  label: string;
}

export interface AbsenceTypeOption {
  code: string;
  label: string;
}

export function AddQuotaOverrideForm({
  employees,
  absenceTypes,
}: {
  employees: EmployeeOption[];
  absenceTypes: AbsenceTypeOption[];
}) {
  const [error, formAction, isPending] = useActionState(addAbsenceQuotaOverride, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Karyawan</label>
        <select name="employeeId" required className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih Karyawan —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Absensi</label>
        <select name="absenceTypeCode" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih Jenis —</option>
          {absenceTypes.map((tp) => (
            <option key={tp.code} value={tp.code}>
              {tp.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jatah Override (hari)</label>
        <input name="annualDays" type="number" min={0} required className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Tambah Override"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

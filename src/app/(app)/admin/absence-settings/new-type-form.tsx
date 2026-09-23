"use client";

import { useActionState } from "react";
import { createAbsenceTypeConfig } from "./actions";

export function NewTypeForm() {
  const [error, formAction, isPending] = useActionState(createAbsenceTypeConfig, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Jenis Absensi Baru</label>
        <input
          name="label"
          required
          placeholder="mis. Cuti Melahirkan"
          className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <label className="mb-2 flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" name="requiresFirstApproval" defaultChecked />
        Perlu Penyetuju Pertama
      </label>
      <label className="mb-2 flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" name="employeeRequestable" defaultChecked />
        Bisa Diajukan Karyawan
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Tambah Jenis"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

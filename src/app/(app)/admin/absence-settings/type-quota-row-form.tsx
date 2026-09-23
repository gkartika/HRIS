"use client";

import { useActionState } from "react";
import { updateAbsenceTypeAndQuota, archiveAbsenceTypeConfig } from "./actions";

export interface AbsenceTypeQuotaRow {
  code: string;
  label: string;
  requiresFirstApproval: boolean;
  activeFlag: boolean;
  annualDays: number | null;
  employeeRequestable: boolean;
  pointsWeight: number;
  countsTowardTdl: boolean;
  hoursMultiplier: number;
}

export function TypeQuotaRowForm({ row }: { row: AbsenceTypeQuotaRow }) {
  const action = updateAbsenceTypeAndQuota.bind(null, row.code);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const archiveAction = archiveAbsenceTypeConfig.bind(null, row.code);
  const [archiveError, archiveFormAction, isArchivePending] = useActionState(archiveAction, undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-xs text-slate-400">{row.code}</p>
        {!row.activeFlag && (
          <form action={archiveFormAction}>
            <button type="submit" disabled={isArchivePending} className="text-xs text-rose-600 hover:underline disabled:opacity-60">
              {isArchivePending ? "Mengarsipkan…" : "Arsipkan"}
            </button>
          </form>
        )}
      </div>
      {archiveError && <p className="mb-2 text-xs text-rose-600">{archiveError}</p>}
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
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="employeeRequestable" defaultChecked={row.employeeRequestable} />
          Bisa Diajukan Karyawan
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="countsTowardTdl" defaultChecked={row.countsTowardTdl} />
          Hitung sebagai Mandays Lost
        </label>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Bobot Poin</label>
          <input
            name="pointsWeight"
            type="number"
            step={1}
            defaultValue={row.pointsWeight}
            className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Pengali Jam Kerja</label>
          <input
            name="hoursMultiplier"
            type="number"
            step={0.5}
            min={0}
            defaultValue={row.hoursMultiplier}
            className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-slate-400">0=tidak dihitung, 1=sehari penuh, 0.5=setengah hari</span>
        </div>
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

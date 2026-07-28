"use client";

import { useActionState } from "react";
import { createPosition } from "./actions";
import type { Job, OrgUnit, Position } from "@/generated/prisma/client";

const POSITION_TYPES = ["STAFF", "TEAM_LEAD", "SECTION_HEAD", "DEPARTMENT_HEAD", "DIRECTOR"];

export function CreatePositionForm({
  jobs,
  orgUnits,
  positions,
}: {
  jobs: Job[];
  orgUnits: OrgUnit[];
  positions: Position[];
}) {
  const [error, formAction, isPending] = useActionState(createPosition, undefined);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kode Posisi</label>
        <input
          name="positionCode"
          required
          placeholder="POS-IT-STAFF-01"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jabatan Standar</label>
        <select name="jobId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Pilih jabatan</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.jobTitle} ({j.jobLevel})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Unit Organisasi</label>
        <select name="orgUnitId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Pilih unit</option>
          {orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Posisi</label>
        <select name="positionType" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {POSITION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Melapor Ke (opsional)</label>
        <select
          name="reportsToPositionId"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Puncak hierarki —</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.positionCode}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">FTE Disetujui</label>
        <input
          name="approvedFte"
          type="number"
          step="0.1"
          min="0.1"
          defaultValue="1"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="md:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Posisi"}
        </button>
      </div>
      {error && <p className="col-span-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

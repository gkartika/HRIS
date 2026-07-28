"use client";

import { useActionState } from "react";
import { updatePosition } from "../actions";
import type { Job, OrgUnit, Position } from "@/generated/prisma/client";

const POSITION_TYPES = ["STAFF", "TEAM_LEAD", "SECTION_HEAD", "DEPARTMENT_HEAD", "DIRECTOR"];
const POSITION_STATUSES = ["PLANNED", "VACANT", "FILLED", "FROZEN", "CLOSED"];

export function EditPositionForm({
  position,
  jobs,
  orgUnits,
  otherPositions,
}: {
  position: Position;
  jobs: Job[];
  orgUnits: OrgUnit[];
  otherPositions: Position[];
}) {
  const updateWithId = updatePosition.bind(null, position.id);
  const [error, formAction, isPending] = useActionState(updateWithId, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jabatan Standar</label>
        <select
          name="jobId"
          defaultValue={position.jobId}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.jobTitle} ({j.jobLevel})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Unit Organisasi</label>
        <select
          name="orgUnitId"
          defaultValue={position.orgUnitId}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Posisi</label>
        <select
          name="positionType"
          defaultValue={position.positionType}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {POSITION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Melapor Ke</label>
        <select
          name="reportsToPositionId"
          defaultValue={position.reportsToPositionId ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Puncak hierarki —</option>
          {otherPositions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.positionCode}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Status Posisi</label>
        <select
          name="positionStatus"
          defaultValue={position.positionStatus}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {POSITION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Kosong/Terisi biasanya diperbarui otomatis saat Penempatan berubah — atur manual di sini
          hanya untuk Direncanakan/Dibekukan/Ditutup.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">FTE Disetujui</label>
        <input
          name="approvedFte"
          type="number"
          step="0.1"
          min="0.1"
          defaultValue={position.approvedFte}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useRef } from "react";
import { createPosition } from "./actions";
import { POSITION_TYPES } from "@/lib/position-type";
import type { Job, OrgUnit, Position } from "@/generated/prisma/client";

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
  const orgUnitRef = useRef<HTMLSelectElement>(null);
  const positionTypeRef = useRef<HTMLSelectElement>(null);
  const hrManagerPositionCode = positions.find((p) => p.grantsHrManagerAccess)?.positionCode ?? null;

  // Pre-fills Unit Organisasi/Jenis Posisi from the selected Job's own
  // defaults (set on the Job's edit page) — a convenience only, never
  // required: HR Admin can still change either field afterward for this
  // specific seat, same Job reusable across different units/tiers as
  // always.
  function handleJobChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const job = jobs.find((j) => j.id === e.target.value);
    if (job?.defaultOrgUnitId && orgUnitRef.current) orgUnitRef.current.value = job.defaultOrgUnitId;
    if (job?.defaultPositionType && positionTypeRef.current) positionTypeRef.current.value = job.defaultPositionType;
  }

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
        <select
          name="jobId"
          required
          onChange={handleJobChange}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Pilih jabatan</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.jobTitle}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Level</label>
        <input
          name="jobLevel"
          required
          placeholder="2A"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Unit Organisasi</label>
        <select
          name="orgUnitId"
          required
          ref={orgUnitRef}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
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
        <select
          name="positionType"
          required
          ref={positionTypeRef}
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
      <div className="flex flex-col justify-end pb-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="grantsHrManagerAccess" />
          Memberikan Akses HR Manager
        </label>
        {hrManagerPositionCode && (
          <p className="mt-1 text-xs text-slate-400">
            Hanya satu posisi boleh memilikinya; saat ini <span className="font-mono">{hrManagerPositionCode}</span>.
          </p>
        )}
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

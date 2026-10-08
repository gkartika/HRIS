"use client";

import { useActionState } from "react";
import { updatePosition } from "../actions";
import { POSITION_TYPES } from "@/lib/position-type";
import { t } from "@/lib/i18n/id";
import type { Job, OrgUnit, Position } from "@/generated/prisma/client";

export function EditPositionForm({
  position,
  jobs,
  orgUnits,
  otherPositions,
  otherHrManagerPositionCode,
}: {
  position: Position;
  jobs: Job[];
  orgUnits: OrgUnit[];
  otherPositions: Position[];
  otherHrManagerPositionCode: string | null;
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
          defaultValue={position.jobLevel}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
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
        <span className="mb-1 block text-xs text-slate-500">Status Posisi</span>
        <p className="text-sm text-slate-700">{t(`positionStatus.${position.positionStatus}`)}</p>
        <p className="mt-1 text-xs text-slate-400">
          Otomatis: Terisi jika ada Penempatan aktif, Kosong jika tidak. Posisi yang tidak dipakai lagi cukup diarsipkan.
        </p>
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="grantsHrManagerAccess" defaultChecked={position.grantsHrManagerAccess} />
          Memberikan Akses HR Manager
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Karyawan dengan Penempatan aktif pada Posisi ini otomatis mendapat akses ruang kerja HR Manager
          (ACC-14) — dan kehilangan akses tersebut otomatis saat Penempatan berakhir. Hanya satu posisi yang boleh
          memiliki akses ini.
          {otherHrManagerPositionCode && (
            <> Saat ini dimiliki posisi <span className="font-mono">{otherHrManagerPositionCode}</span>.</>
          )}
        </p>
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

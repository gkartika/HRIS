"use client";

import { useActionState } from "react";
import { updateJob } from "../actions";
import { POSITION_TYPES } from "@/lib/position-type";
import { JOB_APPROVAL_STATUSES } from "@/lib/job";
import type { Job, OrgUnit } from "@/generated/prisma/client";

export function EditJobForm({ job, orgUnits }: { job: Job; orgUnits: OrgUnit[] }) {
  const updateWithId = updateJob.bind(null, job.id);
  const [error, formAction, isPending] = useActionState(updateWithId, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Jabatan</label>
        <input
          name="jobTitle"
          required
          defaultValue={job.jobTitle}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tujuan Jabatan</label>
        <textarea
          name="jobPurpose"
          rows={3}
          defaultValue={job.jobPurpose ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Status Persetujuan</label>
        <select
          name="approvalStatus"
          defaultValue={job.approvalStatus}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {JOB_APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700">Default untuk Posisi Baru (opsional)</p>
        <p className="mt-1 text-xs text-slate-500">
          Saat jabatan ini dipilih di formulir tambah Posisi, Unit Organisasi dan Jenis Posisi di bawah otomatis
          terisi — HR Admin tetap bisa mengubahnya untuk kursi tertentu. Tidak mengunci Posisi yang sudah ada.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Unit Organisasi Default</label>
            <select
              name="defaultOrgUnitId"
              defaultValue={job.defaultOrgUnitId ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Tidak ada —</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Jenis Posisi Default</label>
            <select
              name="defaultPositionType"
              defaultValue={job.defaultPositionType ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Tidak ada —</option>
              {POSITION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
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

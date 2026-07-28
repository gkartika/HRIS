"use client";

import { useActionState } from "react";
import { updateJob } from "../actions";
import type { Job } from "@/generated/prisma/client";

const APPROVAL_STATUSES = ["Draft", "Under Review", "Approved", "Retired"];

export function EditJobForm({ job }: { job: Job }) {
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
        <label className="mb-1 block text-xs text-slate-500">Level</label>
        <input
          name="jobLevel"
          required
          defaultValue={job.jobLevel}
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
          {APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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

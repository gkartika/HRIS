"use client";

import { useActionState } from "react";
import { createJob } from "./actions";

export function CreateJobForm() {
  const [error, formAction, isPending] = useActionState(createJob, undefined);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kode Jabatan</label>
        <input
          name="jobCode"
          required
          placeholder="IT-STAFF"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Jabatan</label>
        <input
          name="jobTitle"
          required
          placeholder="Staf IT"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
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
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Jabatan"}
        </button>
      </div>
      <div className="md:col-span-4">
        <label className="mb-1 block text-xs text-slate-500">Tujuan Jabatan (opsional)</label>
        <textarea
          name="jobPurpose"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="col-span-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

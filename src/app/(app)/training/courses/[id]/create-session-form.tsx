"use client";

import { useActionState } from "react";
import { createTrainingSession } from "../actions";

export function CreateSessionForm({ courseId }: { courseId: string }) {
  const [error, formAction, isPending] = useActionState(createTrainingSession.bind(null, courseId), undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
      {error && <p className="md:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Mulai</label>
        <input name="startDate" type="date" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Selesai</label>
        <input name="endDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Lokasi</label>
        <input name="location" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kapasitas</label>
        <input name="capacity" type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="md:col-span-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Sesi"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { openCompetencyCycle } from "./actions";

export function OpenCompetencyCycleForm() {
  const [error, formAction, isPending] = useActionState(openCompetencyCycle, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4">
      {error && (
        <p className="md:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Label Periode</label>
        <input
          name="periodLabel"
          required
          placeholder="Semester 1 2026"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Mulai / Cutoff</label>
        <input name="startDate" type="date" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Selesai (opsional)</label>
        <input name="endDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Membuka Siklus..." : "Buka Siklus Baru"}
        </button>
      </div>
    </form>
  );
}

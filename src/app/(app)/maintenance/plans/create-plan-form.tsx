"use client";

import { useActionState } from "react";
import { createMaintenancePlan } from "../actions";

interface AssetOption {
  id: string;
  label: string;
}

export function CreatePlanForm({ assets }: { assets: AssetOption[] }) {
  const [error, formAction, isPending] = useActionState(createMaintenancePlan, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-5">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-5">{error}</p>}
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Aset</label>
        <select name="assetId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih Aset —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Deskripsi</label>
        <input name="description" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jatuh Tempo</label>
        <input name="dueDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Interval (hari)</label>
        <input name="intervalDays" type="number" min={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Interval (KM)</label>
        <input name="intervalKm" type="number" min={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-end md:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Buat Rencana"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState, startTransition } from "react";
import { createManualWorkOrder } from "../actions";

interface AssetOption {
  id: string;
  label: string;
}

// "Buat Work Order": the manual start point, for work nobody reported.
export function NewWorkOrderForm({ assets, defaultAssetId = "", defaultOpen = false }: { assets: AssetOption[]; defaultAssetId?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, formData: FormData) => {
    const result = await createManualWorkOrder(prev, formData);
    if (!result) setOpen(false);
    return result;
  }, undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Buat Work Order
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="grid w-full grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4"
    >
      <p className="text-sm font-medium text-slate-900 md:col-span-4">Work order baru</p>
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Aset</label>
        <select name="assetId" required defaultValue={defaultAssetId} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih Aset —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis</label>
        <select name="kind" required defaultValue="CORRECTIVE" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="CORRECTIVE">Perbaikan (aset jadi Dalam Perbaikan)</option>
          <option value="PREVENTIVE">Perawatan rutin (status aset tetap)</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Dikerjakan oleh</label>
        <select name="workType" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="INTERNAL">Internal</option>
          <option value="VENDOR">Vendor</option>
        </select>
      </div>
      <div className="md:col-span-4">
        <label className="mb-1 block text-xs text-slate-500">Keluhan atau pekerjaan yang akan dilakukan</label>
        <input name="checklistNotes" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="mis. layar berkedip, ganti oli dan filter" />
      </div>
      <div className="flex gap-2 md:col-span-4">
        <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {isPending ? "Menyimpan..." : "Buat Work Order"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </form>
  );
}

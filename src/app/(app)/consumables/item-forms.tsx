"use client";

import { useActionState, useEffect, useState } from "react";
import { createConsumableItem, updateConsumableItem } from "./actions";
import { suggestNextItemCode, type ConsumableCategoryValue } from "@/lib/consumables";
import { Dialog } from "./dialog";

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const LABEL = "mb-1 block text-xs text-slate-500";

// The page keys this form on the item count, so a successful add remounts it:
// fields clear and the next free code is suggested from the refreshed list.
export function CreateItemForm({ existingCodes }: { existingCodes: string[] }) {
  const [state, formAction, pending] = useActionState(createConsumableItem, undefined);
  const [category, setCategory] = useState<ConsumableCategoryValue>("APD");
  const [code, setCode] = useState(() => suggestNextItemCode("APD", existingCodes));

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Tambah barang</p>
      {state?.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p>}
      {state?.success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{state.success}</p>}
      <div>
        <label className={LABEL}>Kategori</label>
        <select
          name="category"
          value={category}
          onChange={(e) => {
            const next = e.target.value as ConsumableCategoryValue;
            setCategory(next);
            setCode(suggestNextItemCode(next, existingCodes));
          }}
          className={INPUT}
        >
          <option value="APD">APD</option>
          <option value="ATK">ATK</option>
        </select>
      </div>
      <div>
        <label className={LABEL}>Kode</label>
        <div className="flex gap-2">
          <input name="itemCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required className={`${INPUT} font-mono`} />
          <button
            type="button"
            onClick={() => setCode(suggestNextItemCode(category, existingCodes))}
            className="shrink-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50"
          >
            Otomatis
          </button>
        </div>
      </div>
      <div>
        <label className={LABEL}>Nama barang</label>
        <input name="itemName" required defaultValue={state?.values?.itemName} placeholder="mis. Masker KN95" className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Satuan</label>
          <input name="unit" required defaultValue={state?.values?.unit} placeholder="pcs" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Stok awal</label>
          <input name="openingStock" type="number" min={0} step={1} defaultValue={state?.values?.openingStock ?? 0} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Stok minimum</label>
          <input name="minStock" type="number" min={0} step={1} defaultValue={state?.values?.minStock ?? 0} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Periode ganti (bulan)</label>
          <input name="replacementPeriodMonths" type="number" min={0} step={1} defaultValue={state?.values?.replacementPeriodMonths ?? 0} className={INPUT} />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">Periode 0 berarti tidak dibatasi.</p>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : "Simpan barang"}
      </button>
    </form>
  );
}

interface EditableItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  openingStock: number;
  minStock: number;
  replacementPeriodMonths: number;
}

function EditBody({ item, hasTransactions, close }: { item: EditableItem; hasTransactions: boolean; close: () => void }) {
  const [state, formAction, pending] = useActionState(updateConsumableItem.bind(null, item.id), undefined);
  useEffect(() => {
    if (state?.success) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p>}
      <div>
        <label className={LABEL}>Kode (tidak bisa diubah)</label>
        <input disabled value={item.itemCode} className={`${INPUT} bg-slate-50 font-mono text-slate-400`} />
      </div>
      <div>
        <label className={LABEL}>Nama barang</label>
        <input name="itemName" required defaultValue={state?.values?.itemName ?? item.itemName} className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Satuan</label>
          <input name="unit" required defaultValue={state?.values?.unit ?? item.unit} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Stok awal</label>
          <input
            name="openingStock"
            type="number"
            min={0}
            step={1}
            defaultValue={item.openingStock}
            disabled={hasTransactions}
            className={`${INPUT} ${hasTransactions ? "bg-slate-50 text-slate-400" : ""}`}
          />
        </div>
        <div>
          <label className={LABEL}>Stok minimum</label>
          <input name="minStock" type="number" min={0} step={1} defaultValue={state?.values?.minStock ?? item.minStock} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Periode ganti (bulan)</label>
          <input name="replacementPeriodMonths" type="number" min={0} step={1} defaultValue={state?.values?.replacementPeriodMonths ?? item.replacementPeriodMonths} className={INPUT} />
        </div>
      </div>
      {hasTransactions && <p className="text-[11px] text-slate-400">Stok awal terkunci karena sudah ada transaksi. Gunakan Opname untuk mengoreksi stok.</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
          Batal
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

export function EditItemDialog({ item, hasTransactions }: { item: EditableItem; hasTransactions: boolean }) {
  return (
    <Dialog triggerLabel="Edit" title={`Edit barang · ${item.itemCode}`}>
      {(close) => <EditBody item={item} hasTransactions={hasTransactions} close={close} />}
    </Dialog>
  );
}

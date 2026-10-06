"use client";

import { useActionState, useEffect, useState } from "react";
import { recordConsumableReceipt, recordConsumableAdjustment, type ConsumableActionState } from "./actions";
import { Dialog } from "./dialog";

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const LABEL = "mb-1 block text-xs text-slate-500";

function Feedback({ state, close }: { state: ConsumableActionState; close: () => void }) {
  useEffect(() => {
    if (state?.success) close();
    // close is a stable setter wrapper per dialog open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  if (!state?.error) return null;
  return <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p>;
}

function Actions({ close, pending, label }: { close: () => void; pending: boolean; label: string }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
        Batal
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : label}
      </button>
    </div>
  );
}

function ReceiptBody({ itemId, unit, stock, close }: { itemId: string; unit: string; stock: number; close: () => void }) {
  const [state, formAction, pending] = useActionState(recordConsumableReceipt, undefined);
  const [qty, setQty] = useState(0);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <Feedback state={state} close={close} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Jumlah masuk ({unit})</label>
          <input name="quantity" type="number" min={1} step={1} required defaultValue={state?.values?.quantity} onChange={(e) => setQty(Number(e.target.value) || 0)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Tanggal</label>
          <input name="occurredAt" type="date" defaultValue={state?.values?.occurredAt} className={INPUT} />
        </div>
      </div>
      <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
        Stok {stock} → {stock + qty} {unit}
      </p>
      <div>
        <label className={LABEL}>Keterangan / No. PO (opsional)</label>
        <input name="reference" defaultValue={state?.values?.reference} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Catatan (opsional)</label>
        <input name="note" defaultValue={state?.values?.note} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Dicatat oleh (opsional)</label>
        <input name="recordedByLabel" defaultValue={state?.values?.recordedByLabel} className={INPUT} />
      </div>
      <Actions close={close} pending={pending} label="Simpan barang masuk" />
    </form>
  );
}

function AdjustmentBody({ itemId, unit, stock, close }: { itemId: string; unit: string; stock: number; close: () => void }) {
  const [state, formAction, pending] = useActionState(recordConsumableAdjustment, undefined);
  const [physical, setPhysical] = useState(String(stock));
  const delta = (Number(physical) || 0) - stock;
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <Feedback state={state} close={close} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Stok sistem</label>
          <input disabled value={stock} className={`${INPUT} bg-slate-50 text-slate-400`} />
        </div>
        <div>
          <label className={LABEL}>Stok fisik (hasil hitung)</label>
          <input
            name="physicalStock"
            type="number"
            min={0}
            step={1}
            required
            value={physical}
            onChange={(e) => setPhysical(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>
      <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
        {delta === 0 ? "Tidak ada selisih." : `Selisih ${delta > 0 ? "+" : ""}${delta} ${unit}. Stok menjadi ${Number(physical) || 0}.`}
      </p>
      <div>
        <label className={LABEL}>Alasan (wajib)</label>
        <input name="reason" required defaultValue={state?.values?.reason} placeholder="mis. selisih hasil hitung gudang" className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Dicatat oleh (opsional)</label>
        <input name="recordedByLabel" defaultValue={state?.values?.recordedByLabel} className={INPUT} />
      </div>
      <Actions close={close} pending={pending} label="Simpan penyesuaian" />
    </form>
  );
}

export function ReceiptDialog({ itemId, itemName, unit, stock }: { itemId: string; itemName: string; unit: string; stock: number }) {
  return (
    <Dialog triggerLabel="+ Masuk" title={`Barang masuk · ${itemName}`}>
      {(close) => <ReceiptBody itemId={itemId} unit={unit} stock={stock} close={close} />}
    </Dialog>
  );
}

export function AdjustmentDialog({ itemId, itemName, unit, stock }: { itemId: string; itemName: string; unit: string; stock: number }) {
  return (
    <Dialog
      triggerLabel="Opname"
      title={`Opname · ${itemName}`}
      description="Isi hasil hitung fisik. Selisih dihitung dari stok sistem saat disimpan."
    >
      {(close) => <AdjustmentBody itemId={itemId} unit={unit} stock={stock} close={close} />}
    </Dialog>
  );
}

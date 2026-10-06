"use client";

import { useActionState, useEffect } from "react";
import { cancelConsumableTransaction } from "./actions";
import { Dialog } from "./dialog";

function CancelBody({ txId, summary, warning, close }: { txId: string; summary: string; warning?: string; close: () => void }) {
  const [state, formAction, pending] = useActionState(cancelConsumableTransaction.bind(null, txId), undefined);
  useEffect(() => {
    if (state?.success) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-slate-500">
        {summary}. Transaksi tidak dihapus: tetap terlihat dengan tanda Dibatalkan, dan tidak lagi ikut menghitung stok.
      </p>
      {warning && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</p>}
      {state?.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Alasan pembatalan (wajib)</label>
        <input name="reason" required defaultValue={state?.values?.reason} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
          Kembali
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "Membatalkan..." : "Batalkan transaksi"}
        </button>
      </div>
    </form>
  );
}

export function CancelDialog({ txId, summary, warning }: { txId: string; summary: string; warning?: string }) {
  return (
    <Dialog
      triggerLabel="Batalkan"
      triggerClassName="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
      title="Batalkan transaksi"
    >
      {(close) => <CancelBody txId={txId} summary={summary} warning={warning} close={close} />}
    </Dialog>
  );
}

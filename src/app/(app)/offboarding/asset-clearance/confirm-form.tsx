"use client";

import { useActionState } from "react";
import { confirmGaAssetClearance } from "../actions";

export function ConfirmGaAssetClearanceForm({ caseId }: { caseId: string }) {
  const action = confirmGaAssetClearance.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <label className="block text-xs text-slate-500">Catatan (opsional)</label>
      <textarea
        name="gaAssetClearanceNote"
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? "Memproses..." : "Konfirmasi & Kembalikan Semua Aset Sekaligus"}
      </button>
    </form>
  );
}

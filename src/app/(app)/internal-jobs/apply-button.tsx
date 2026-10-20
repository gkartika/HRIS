"use client";

import { useState, useTransition } from "react";
import { applyInternalAction } from "./actions";

export function ApplyInternalButton({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const message = await applyInternalAction(requestId);
      if (message) setError(message);
    });
  }

  return (
    <div>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Lamar posisi ini
        </button>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Setelah melamar Anda langsung mengerjakan tes online. Atasan Anda tidak diberi tahu sampai posisi baru resmi Anda dapatkan.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending} onClick={apply} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {pending ? "Mengirim..." : "Ya, lamar dan mulai tes"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              Batal
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

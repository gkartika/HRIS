"use client";

import { useActionState, useState } from "react";
import { createObsoleteDisposalCase } from "@/app/(app)/disposal-cases/actions";

export function MarkObsoleteForm({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createObsoleteDisposalCase.bind(null, assetId), undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        Tandai Obsolete
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 w-80 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <label className="block text-xs text-amber-800">Catatan</label>
      <textarea name="proposalNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Buat Kasus Disposal"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          Batal
        </button>
      </div>
    </form>
  );
}

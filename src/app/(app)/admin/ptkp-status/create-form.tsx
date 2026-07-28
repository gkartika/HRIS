"use client";

import { useActionState } from "react";
import { createPtkpStatus } from "./actions";

export function CreatePtkpStatusForm() {
  const [error, formAction, isPending] = useActionState(createPtkpStatus, undefined);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kode PTKP</label>
        <input
          name="code"
          required
          placeholder="K/I/1"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Label</label>
        <input
          name="label"
          required
          placeholder="Kawin, Istri Bekerja, 1 Tanggungan"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah"}
        </button>
      </div>
      {error && <p className="col-span-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

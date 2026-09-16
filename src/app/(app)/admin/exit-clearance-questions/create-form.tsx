"use client";

import { useActionState } from "react";
import { createExitClearanceQuestion } from "./actions";

export function CreateExitClearanceQuestionForm() {
  const [error, formAction, isPending] = useActionState(createExitClearanceQuestion, undefined);

  return (
    <form action={formAction} className="flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-slate-500">Pertanyaan Baru</label>
        <textarea
          name="questionText"
          required
          rows={2}
          placeholder="mis. Apakah Anda telah mengembalikan seluruh aset perusahaan yang Anda pegang?"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Tambah"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

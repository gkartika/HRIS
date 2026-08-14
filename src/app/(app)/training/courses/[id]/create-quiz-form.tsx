"use client";

import { useActionState } from "react";
import { createQuiz } from "../actions";

export function CreateQuizForm({ courseId }: { courseId: string }) {
  const [error, formAction, isPending] = useActionState(createQuiz.bind(null, courseId), undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
      {error && <p className="md:col-span-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nilai Kelulusan (%)</label>
        <input
          name="passingScorePercent"
          type="number"
          min={1}
          max={100}
          defaultValue={70}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Batas Percobaan</label>
        <input
          name="maxAttempts"
          type="number"
          min={1}
          defaultValue={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Aktifkan Kuis"}
        </button>
      </div>
    </form>
  );
}

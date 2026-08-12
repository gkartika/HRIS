"use client";

import { useActionState } from "react";
import { recordLearningEffectiveness } from "../learning-assignments/actions";

export function EffectivenessForm({ assignmentId }: { assignmentId: string }) {
  const [error, formAction, isPending] = useActionState(recordLearningEffectiveness.bind(null, assignmentId), undefined);

  return (
    <form action={formAction} className="space-y-2">
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Bukti/Evidence (opsional)</label>
        <textarea name="evidence" rows={2} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          name="result"
          value="EFFECTIVE"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Efektif
        </button>
        <button
          type="submit"
          name="result"
          value="NOT_EFFECTIVE"
          disabled={isPending}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          Tidak Efektif
        </button>
      </div>
    </form>
  );
}

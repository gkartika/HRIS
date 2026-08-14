"use client";

import { useActionState } from "react";
import { applyMandatoryTrainingRuleAction } from "./actions";

export function ApplyRuleButton({
  ruleId,
  label,
  alreadyAssignedCount = 0,
}: {
  ruleId: string;
  label?: string;
  alreadyAssignedCount?: number;
}) {
  const [error, formAction, isPending] = useActionState(applyMandatoryTrainingRuleAction.bind(null, ruleId), undefined);

  return (
    <form action={formAction} className={label ? "space-y-2" : undefined}>
      {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
      {label && alreadyAssignedCount > 0 && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Alasan Penyegaran (isi untuk juga menugaskan ulang {alreadyAssignedCount} karyawan yang sudah memiliki
            penugasan aktif sebagai refresher — kosongkan untuk melewati mereka)
          </label>
          <textarea name="refresherReason" rows={2} className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className={
          label
            ? "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            : "text-xs text-indigo-600 hover:underline disabled:opacity-60"
        }
      >
        {isPending ? "Menerapkan..." : (label ?? "Terapkan")}
      </button>
    </form>
  );
}

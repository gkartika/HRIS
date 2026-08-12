"use client";

import { useActionState } from "react";
import { decideTrainingRequestAsDeptHead } from "../actions";
import { t } from "@/lib/i18n/id";

export function DeptHeadDecisionForm({ requestId }: { requestId: string }) {
  const [error, formAction, isPending] = useActionState(decideTrainingRequestAsDeptHead.bind(null, requestId), undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.rejectReasonLabel")} (wajib jika menolak)</label>
        <textarea name="note" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {t("trainingRequest.approveButton")}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={isPending}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {t("trainingRequest.rejectButton")}
        </button>
      </div>
    </form>
  );
}

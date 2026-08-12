"use client";

import { useActionState, useState } from "react";
import { cancelTrainingRequest } from "../actions";
import { t } from "@/lib/i18n/id";

export function CancelForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(cancelTrainingRequest.bind(null, requestId), undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-rose-600 hover:underline">
        {t("trainingRequest.cancelButton")}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.cancellationReasonLabel")}</label>
        <textarea name="reason" required rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {isPending ? "Membatalkan..." : t("trainingRequest.cancelButton")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

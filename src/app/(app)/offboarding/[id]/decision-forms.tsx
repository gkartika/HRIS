"use client";

import { useActionState, useState } from "react";
import { executeExitClearance, cancelOffboardingCase } from "../actions";
import { t } from "@/lib/i18n/id";

export function ExecuteExitClearanceForm({ caseId }: { caseId: string }) {
  const action = executeExitClearance.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("offboarding.clearanceTitle")}</p>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.clearanceNote")}</label>
        <textarea name="clearanceNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("offboarding.clearanceButton")}
      </button>
    </form>
  );
}

export function CancelOffboardingCaseForm({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const action = cancelOffboardingCase.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
      >
        {t("offboarding.cancelButton")}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.cancellationReason")}</label>
        <textarea name="cancellationReason" required rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("offboarding.cancelButton")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

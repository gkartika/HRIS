"use client";

import { ReasonForm } from "@/components/reason-form";
import { useActionState } from "react";
import { executeExitClearance, cancelOffboardingCase } from "../actions";
import { t } from "@/lib/i18n/id";
import { FormNumberBadge } from "../form-number";

export function ExecuteExitClearanceForm({ caseId }: { caseId: string }) {
  const action = executeExitClearance.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{t("offboarding.clearanceTitle")}</p>
        <FormNumberBadge />
      </div>
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
  return (
    <ReasonForm
      action={cancelOffboardingCase.bind(null, caseId)}
      triggerLabel={t("offboarding.cancelButton")}
      reasonLabel={t("offboarding.cancellationReason")}
      variant="slate"
      required
    />
  );
}

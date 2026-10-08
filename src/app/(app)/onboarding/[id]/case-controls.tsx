"use client";

import { useActionState, useState } from "react";
import {
  cancelOnboardingCase,
  reopenOnboardingCase,
  updateOnboardingPlannedStartDate,
} from "../actions";
import { ReasonForm } from "@/components/reason-form";
import { t } from "@/lib/i18n/id";

// Cancel a case that no longer applies (no-show, entered by mistake, left
// during onboarding). The page decides who sees this; the server checks too.
export function CancelOnboardingForm({ caseId }: { caseId: string }) {
  return (
    <ReasonForm
      action={cancelOnboardingCase.bind(null, caseId)}
      triggerLabel={t("onboarding.cancelCase")}
      reasonLabel={t("onboarding.cancelReason")}
      required
    />
  );
}

export function ReopenOnboardingButton({ caseId }: { caseId: string }) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    setError(await reopenOnboardingCase(caseId));
    setIsPending(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("onboarding.reopenCase")}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function PlannedStartDateForm({ caseId, plannedStartDate }: { caseId: string; plannedStartDate: string }) {
  const action = updateOnboardingPlannedStartDate.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("onboarding.plannedStartDate")}</label>
        <input
          type="date"
          name="plannedStartDate"
          required
          defaultValue={plannedStartDate}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("onboarding.editStartDate")}
      </button>
      <p className="basis-full text-xs text-slate-400">{t("onboarding.startDateHint")}</p>
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

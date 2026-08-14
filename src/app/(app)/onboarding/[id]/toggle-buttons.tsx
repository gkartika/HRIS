"use client";

import { useState } from "react";
import { useActionState } from "react";
import { toggleContractComplete, updateMandatoryMaterialDueDate } from "../actions";
import { t } from "@/lib/i18n/id";

function ToggleButton({
  caseId,
  complete,
  label,
  canToggle,
  action,
}: {
  caseId: string;
  complete: boolean;
  label: string;
  canToggle: boolean;
  action: (caseId: string) => Promise<string | undefined>;
}) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    const result = await action(caseId);
    setIsPending(false);
    setError(result);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
          }`}
        >
          {complete ? "✓" : "—"}
        </span>
        <span className="text-sm text-slate-900">{label}</span>
      </div>
      {canToggle ? (
        <button
          onClick={handleClick}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
            complete
              ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {isPending ? t("common.loading") : complete ? t("onboarding.markIncomplete") : t("onboarding.markComplete")}
        </button>
      ) : (
        <span className="text-xs text-slate-400">
          {complete ? t("onboardingStatus.COMPLETE") : t("onboarding.notYetComplete")}
        </span>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function ContractToggle({ caseId, complete, canToggle }: { caseId: string; complete: boolean; canToggle: boolean }) {
  return (
    <ToggleButton caseId={caseId} complete={complete} label={t("onboarding.contractComplete")} canToggle={canToggle} action={toggleContractComplete} />
  );
}

// "Materi Wajib" and "Perlengkapan" have no toggle anymore — both are
// derived from real data (course completion, asset custody status),
// rendered inline in ../[id]/page.tsx, never manually set.

export function DueDateForm({
  caseId,
  dueDate,
  canEdit,
}: {
  caseId: string;
  dueDate: string;
  canEdit: boolean;
}) {
  const action = updateMandatoryMaterialDueDate.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!canEdit) return null;

  return (
    <form action={formAction} className="mt-3 flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("onboarding.mandatoryMaterialDueDate")}</label>
        <input
          type="date"
          name="mandatoryMaterialDueDate"
          defaultValue={dueDate}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("common.save")}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

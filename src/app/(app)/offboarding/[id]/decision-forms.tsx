"use client";

import { useActionState, useState } from "react";
import { decideOffboardingCaseAsDeptHead, decideOffboardingCase, executeExitClearance, cancelOffboardingCase } from "../actions";
import { t } from "@/lib/i18n/id";

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

function DecisionPositionField({ positions }: { positions: DecisionPositionOption[] }) {
  if (positions.length === 0) return null;
  if (positions.length === 1) {
    return <input type="hidden" name="decisionPositionId" value={positions[0].positionId} />;
  }
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{t("recruitment.decisionPosition")}</label>
      <select name="decisionPositionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        {positions.map((p) => (
          <option key={p.positionId} value={p.positionId}>
            {p.jobTitle} ({p.positionCode})
          </option>
        ))}
      </select>
    </div>
  );
}

export function DecideOffboardingCaseAsDeptHeadForm({
  caseId,
  decisionPositions,
}: {
  caseId: string;
  decisionPositions: DecisionPositionOption[];
}) {
  const action = decideOffboardingCaseAsDeptHead.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("offboarding.deptHeadDecisionTitle")}</p>
      <DecisionPositionField positions={decisionPositions} />
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.deptHeadNote")}</label>
        <textarea name="deptHeadNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("offboarding.approveButton")}
      </button>
    </form>
  );
}

export function DecideOffboardingCaseForm({
  caseId,
  decisionPositions,
}: {
  caseId: string;
  decisionPositions: DecisionPositionOption[];
}) {
  const action = decideOffboardingCase.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("offboarding.hrManagerDecisionTitle")}</p>
      <DecisionPositionField positions={decisionPositions} />
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.hrManagerNote")}</label>
        <textarea name="hrManagerNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("offboarding.approveButton")}
      </button>
    </form>
  );
}

export function ExecuteExitClearanceForm({ caseId }: { caseId: string }) {
  const action = executeExitClearance.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("offboarding.clearanceTitle")}</p>
      <p className="text-xs text-amber-700">{t("offboarding.clearanceAssetNotice")}</p>
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

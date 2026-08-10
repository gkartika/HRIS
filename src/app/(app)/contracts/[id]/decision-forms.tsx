"use client";

import { useActionState, useState } from "react";
import {
  startContractReview,
  submitContractRecommendation,
  decideContractRenewal,
  createRenewalDraft,
  releaseContract,
  signContract,
  activateContract,
} from "../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, EmploymentStatus } from "@/generated/prisma/client";

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

function SimpleActionButton({
  action,
  label,
  tone,
}: {
  action: () => Promise<string | undefined>;
  label: string;
  tone: string;
}) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const handleClick = async () => {
    setIsPending(true);
    const result = await action();
    setIsPending(false);
    setError(result);
  };
  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${tone}`}
      >
        {isPending ? t("common.loading") : label}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function StartReviewButton({ contractId }: { contractId: string }) {
  return (
    <SimpleActionButton
      action={() => startContractReview(contractId)}
      label={t("contract.startReviewButton")}
      tone="border border-slate-200 text-slate-700 hover:bg-slate-50"
    />
  );
}
// Per direct user request: releasing a Draft now needs an active HR
// Manager Position's approval (WF-02 evidence), so unlike the other simple
// buttons on this page it's a form, not a zero-arg SimpleActionButton.
export function ReleaseContractForm({
  contractId,
  positions,
}: {
  contractId: string;
  positions: DecisionPositionOption[];
}) {
  const action = releaseContract.bind(null, contractId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <DecisionPositionField positions={positions} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contract.releaseButton")}
      </button>
    </form>
  );
}

export function SignButton({ contractId }: { contractId: string }) {
  return (
    <SimpleActionButton
      action={() => signContract(contractId)}
      label={t("contract.signButton")}
      tone="bg-indigo-600 text-white hover:bg-indigo-700"
    />
  );
}
export function ActivateButton({ contractId }: { contractId: string }) {
  return (
    <SimpleActionButton
      action={() => activateContract(contractId)}
      label={t("contract.activateButton")}
      tone="bg-emerald-600 text-white hover:bg-emerald-700"
    />
  );
}

export function RecommendationForm({
  contractId,
  employees,
  currentEmployeeId,
  isHrAdmin,
}: {
  contractId: string;
  employees: Employee[];
  currentEmployeeId: string | null;
  isHrAdmin: boolean;
}) {
  const action = submitContractRecommendation.bind(null, contractId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">{t("contract.recommendationTitle")}</p>
      {isHrAdmin ? (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contract.recommendationByLabel")}</label>
          <select
            name="recommendationByEmployeeId"
            required
            defaultValue={currentEmployeeId ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Pilih Karyawan —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="recommendationByEmployeeId" value={currentEmployeeId ?? ""} />
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.recommendation")}</label>
        <select name="recommendation" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          <option value="RENEW">{t("contractRenewalRecommendation.RENEW")}</option>
          <option value="NOT_RENEW">{t("contractRenewalRecommendation.NOT_RENEW")}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.recommendationNote")}</label>
        <textarea name="recommendationNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contract.submitRecommendationButton")}
      </button>
    </form>
  );
}

function DecisionPositionField({ positions }: { positions: DecisionPositionOption[] }) {
  if (positions.length === 0) return null;
  if (positions.length === 1) {
    return <input type="hidden" name="decisionPositionId" value={positions[0].positionId} />;
  }
  return (
    <div>
      <label className="block text-xs text-slate-500">{t("recruitment.decisionPosition")}</label>
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

function DecisionButton({
  contractId,
  decision,
  label,
  tone,
  requireNote,
  positions,
}: {
  contractId: string;
  decision: "RENEW" | "NOT_RENEW";
  label: string;
  tone: string;
  requireNote: boolean;
  positions: DecisionPositionOption[];
}) {
  const [open, setOpen] = useState(false);
  const action = decideContractRenewal.bind(null, contractId, decision);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tone}`}>
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <DecisionPositionField positions={positions} />
      <label className="block text-xs text-slate-500">
        {t("recruitment.decisionNote")} {requireNote && "(wajib)"}
      </label>
      <textarea name="decisionNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${tone}`}
        >
          {isPending ? t("common.loading") : label}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function RenewalDecisionButtons({
  contractId,
  positions,
}: {
  contractId: string;
  positions: DecisionPositionOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        contractId={contractId}
        decision="RENEW"
        label={t("contract.renewButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        positions={positions}
      />
      <DecisionButton
        contractId={contractId}
        decision="NOT_RENEW"
        label={t("contract.notRenewButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        positions={positions}
      />
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateRenewalDraftForm({
  contractId,
  defaultContractType,
}: {
  contractId: string;
  defaultContractType: EmploymentStatus;
}) {
  const action = createRenewalDraft.bind(null, contractId);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const CONTRACT_TYPES: EmploymentStatus[] = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"];

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.contractType")}</label>
        <select
          name="contractType"
          required
          defaultValue={defaultContractType}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {CONTRACT_TYPES.map((ct) => (
            <option key={ct} value={ct}>
              {t(`employmentStatus.${ct}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.startDate")}</label>
        <input
          name="startDate"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">
          {t("contract.endDate")} <span className="text-slate-400">({t("contract.indefinite")})</span>
        </label>
        <input name="endDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contract.createRenewalDraftButton")}
      </button>
    </form>
  );
}

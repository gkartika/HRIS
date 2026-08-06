"use client";

import { useActionState, useState } from "react";
import {
  submitDeptHeadRecommendation,
  decideRenewalCase,
  createRenewalContractAfterMovementExecuted,
  createOffboardingHandoff,
} from "../renewal-actions";
import { t } from "@/lib/i18n/id";
import type { Position, Job, OrgUnit } from "@/generated/prisma/client";
import type { RenewalRecommendation } from "@/generated/prisma/enums";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

const RECOMMENDATIONS: RenewalRecommendation[] = [
  "PERPANJANG_3",
  "PERPANJANG_6",
  "PERPANJANG_12",
  "TIDAK_DIPERPANJANG",
  "MUTASI",
  "DEMOSI",
];

function requiresPosition(rec: RenewalRecommendation | ""): boolean {
  return rec === "MUTASI" || rec === "DEMOSI";
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

export function DeptHeadRecommendationForm({
  caseId,
  positions,
  decisionPositions,
}: {
  caseId: string;
  positions: PositionOption[];
  decisionPositions: DecisionPositionOption[];
}) {
  const action = submitDeptHeadRecommendation.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [recommendation, setRecommendation] = useState<RenewalRecommendation | "">("");

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("contractRenewal.deptHeadRecommendationTitle")}</p>
      <DecisionPositionField positions={decisionPositions} />
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.recommendation")}</label>
        <select
          name="recommendation"
          required
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value as RenewalRecommendation)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Pilih —</option>
          {RECOMMENDATIONS.map((r) => (
            <option key={r} value={r}>
              {t(`renewalRecommendation.${r}`)}
            </option>
          ))}
        </select>
      </div>
      {requiresPosition(recommendation) && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.proposedPosition")}</label>
          <select name="proposedPositionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positionCode} — {p.jobLevel} {p.job.jobTitle} ({p.orgUnit.unitName})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.deptHeadNote")}</label>
        <textarea name="deptHeadNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contractRenewal.submitRecommendationButton")}
      </button>
    </form>
  );
}

function HrManagerDecisionButton({
  caseId,
  decision,
  label,
  tone,
  positions,
  decisionPositions,
  deptHeadRecommendation,
}: {
  caseId: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  label: string;
  tone: string;
  positions: PositionOption[];
  decisionPositions: DecisionPositionOption[];
  deptHeadRecommendation: RenewalRecommendation | null;
}) {
  const [open, setOpen] = useState(false);
  const action = decideRenewalCase.bind(null, caseId, decision);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [finalRecommendation, setFinalRecommendation] = useState<RenewalRecommendation | "">(deptHeadRecommendation ?? "");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tone}`}>
        {label}
      </button>
    );
  }

  const changed = decision === "APPROVED" && !!finalRecommendation && finalRecommendation !== deptHeadRecommendation;

  return (
    <form action={formAction} className="w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <DecisionPositionField positions={decisionPositions} />
      {decision === "APPROVED" && (
        <>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.finalRecommendation")}</label>
            <select
              name="finalRecommendation"
              required
              value={finalRecommendation}
              onChange={(e) => setFinalRecommendation(e.target.value as RenewalRecommendation)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Pilih —</option>
              {RECOMMENDATIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`renewalRecommendation.${r}`)}
                </option>
              ))}
            </select>
          </div>
          {requiresPosition(finalRecommendation) && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.proposedPosition")}</label>
              <select name="proposedPositionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Pilih —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.positionCode} — {p.jobLevel} {p.job.jobTitle} ({p.orgUnit.unitName})
                  </option>
                ))}
              </select>
            </div>
          )}
          {changed && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.changeReason")} (wajib)</label>
              <textarea name="changeReason" required rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          )}
        </>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">
          {t("contractRenewal.decisionNote")} {decision !== "APPROVED" && "(wajib)"}
        </label>
        <textarea name="decisionNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
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

export function HrManagerDecisionButtons({
  caseId,
  positions,
  decisionPositions,
  deptHeadRecommendation,
}: {
  caseId: string;
  positions: PositionOption[];
  decisionPositions: DecisionPositionOption[];
  deptHeadRecommendation: RenewalRecommendation | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <HrManagerDecisionButton
        caseId={caseId}
        decision="APPROVED"
        label={t("contractRenewal.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        positions={positions}
        decisionPositions={decisionPositions}
        deptHeadRecommendation={deptHeadRecommendation}
      />
      <HrManagerDecisionButton
        caseId={caseId}
        decision="RETURNED"
        label={t("contractRenewal.returnButton")}
        tone="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        positions={positions}
        decisionPositions={decisionPositions}
        deptHeadRecommendation={deptHeadRecommendation}
      />
      <HrManagerDecisionButton
        caseId={caseId}
        decision="REJECTED"
        label={t("contractRenewal.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        positions={positions}
        decisionPositions={decisionPositions}
        deptHeadRecommendation={deptHeadRecommendation}
      />
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function GenerateContractForm({ caseId }: { caseId: string }) {
  const action = createRenewalContractAfterMovementExecuted.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("contractRenewal.generateContractTitle")}</p>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.startDate")}</label>
        <input name="startDate" type="date" required defaultValue={todayIso()} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
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
        {isPending ? t("common.loading") : t("contractRenewal.generateContractButton")}
      </button>
    </form>
  );
}

export function CreateOffboardingHandoffForm({ caseId }: { caseId: string }) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    const result = await createOffboardingHandoff(caseId);
    setIsPending(false);
    setError(result);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="mb-3 text-sm font-medium text-slate-900">{t("offboarding.handoffTitle")}</p>
      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("offboarding.handoffButton")}
      </button>
    </div>
  );
}

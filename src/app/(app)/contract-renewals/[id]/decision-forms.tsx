"use client";

import { useActionState, useState } from "react";
import {
  sendRenewalEvaluation,
  submitRenewalEvaluation,
  submitDeptHeadRecommendation,
  decideRenewalCase,
  createRenewalContractAfterMovementExecuted,
} from "../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, Position, Job, OrgUnit } from "@/generated/prisma/client";
import type { RenewalRecommendation } from "@/generated/prisma/enums";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

const SCORE_OPTIONS = [2, 4, 6, 8] as const;
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

function ScoreField({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      <select name={name} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <option value="">— Pilih —</option>
        {SCORE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
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

export function SendEvaluationForm({ caseId, employees }: { caseId: string; employees: Employee[] }) {
  const action = sendRenewalEvaluation.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{t("contractRenewal.sendEvaluationTitle")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.p1Label")}</label>
          <select name="p1EmployeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih Karyawan —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.preferredName ?? e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.p2Label")}</label>
          <select name="p2EmployeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih Karyawan —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.preferredName ?? e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.attendanceSakit")}</label>
          <input name="attendanceSakit" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.attendanceIjin")}</label>
          <input name="attendanceIjin" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.attendanceAlpha")}</label>
          <input name="attendanceAlpha" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.attendanceIjinHalfDay")}</label>
          <input name="attendanceIjinHalfDay" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contractRenewal.sendEvaluationButton")}
      </button>
    </form>
  );
}

export function EvaluationForm({ caseId, slot }: { caseId: string; slot: "P1" | "P2" }) {
  const action = submitRenewalEvaluation.bind(null, caseId, slot);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [useKpi, setUseKpi] = useState(false);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">
        {t(slot === "P1" ? "contractRenewal.p1EvaluationTitle" : "contractRenewal.p2EvaluationTitle")}
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="useKpi" checked={useKpi} onChange={(e) => setUseKpi(e.target.checked)} />
        {t("contractRenewal.useKpiLabel")}
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {useKpi ? (
          <ScoreField name="kpiProductivity" label={t("contractRenewal.kpiProductivity")} />
        ) : (
          <>
            <ScoreField name="qualityOrientation" label={t("contractRenewal.qualityOrientation")} />
            <ScoreField name="problemSolving" label={t("contractRenewal.problemSolving")} />
            <ScoreField name="communicationLeadership" label={t("contractRenewal.communicationLeadership")} />
            <ScoreField name="technicalExpertise" label={t("contractRenewal.technicalExpertise")} />
            <ScoreField name="workDiscipline" label={t("contractRenewal.workDiscipline")} />
          </>
        )}
        <ScoreField name="absensi" label={t("contractRenewal.absensi")} />
        <ScoreField name="tugasKhusus" label={t("contractRenewal.tugasKhusus")} />
        <ScoreField name="sp" label={t("contractRenewal.sp")} />
        <ScoreField name="kompetensi" label={t("contractRenewal.kompetensi")} />
        <ScoreField name="companyValue1" label={t("contractRenewal.companyValue1")} />
        <ScoreField name="companyValue2" label={t("contractRenewal.companyValue2")} />
        <ScoreField name="companyValue3" label={t("contractRenewal.companyValue3")} />
        <ScoreField name="companyValue4" label={t("contractRenewal.companyValue4")} />
        <ScoreField name="companyValue5" label={t("contractRenewal.companyValue5")} />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contractRenewal.submitEvaluationButton")}
      </button>
    </form>
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
                {p.positionCode} — {p.job.jobTitle} / {p.job.jobLevel} ({p.orgUnit.unitName})
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
                    {p.positionCode} — {p.job.jobTitle} / {p.job.jobLevel} ({p.orgUnit.unitName})
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

"use client";

import { useActionState, useState } from "react";
import { releaseEvaluation, submitEvaluation, createManualEvaluation } from "./actions";
import { t } from "@/lib/i18n/id";
import type { Employee } from "@/generated/prisma/client";

const SCORE_OPTIONS = [2, 4, 6, 8] as const;

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

export function ReleaseEvaluationForm({ evaluationId, employees }: { evaluationId: string; employees: Employee[] }) {
  const action = releaseEvaluation.bind(null, evaluationId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">{t("evaluation.releaseTitle")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.p1Label")}</label>
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
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.p2Label")}</label>
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
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.attendanceSakit")}</label>
          <input name="attendanceSakit" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.attendanceIjin")}</label>
          <input name="attendanceIjin" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.attendanceAlpha")}</label>
          <input name="attendanceAlpha" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.attendanceIjinHalfDay")}</label>
          <input name="attendanceIjinHalfDay" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("evaluation.releaseButton")}
      </button>
    </form>
  );
}

export function EvaluationSlotForm({ evaluationId, slot }: { evaluationId: string; slot: "P1" | "P2" }) {
  const action = submitEvaluation.bind(null, evaluationId, slot);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [useKpi, setUseKpi] = useState(false);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">
        {t(slot === "P1" ? "evaluation.p1Title" : "evaluation.p2Title")}
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="useKpi" checked={useKpi} onChange={(e) => setUseKpi(e.target.checked)} />
        {t("evaluation.useKpiLabel")}
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {useKpi ? (
          <ScoreField name="kpiProductivity" label={t("evaluation.kpiProductivity")} />
        ) : (
          <>
            <ScoreField name="qualityOrientation" label={t("evaluation.qualityOrientation")} />
            <ScoreField name="problemSolving" label={t("evaluation.problemSolving")} />
            <ScoreField name="communicationLeadership" label={t("evaluation.communicationLeadership")} />
            <ScoreField name="technicalExpertise" label={t("evaluation.technicalExpertise")} />
            <ScoreField name="workDiscipline" label={t("evaluation.workDiscipline")} />
          </>
        )}
        <ScoreField name="absensi" label={t("evaluation.absensi")} />
        <ScoreField name="tugasKhusus" label={t("evaluation.tugasKhusus")} />
        <ScoreField name="sp" label={t("evaluation.sp")} />
        <ScoreField name="kompetensi" label={t("evaluation.kompetensi")} />
        <ScoreField name="companyValue1" label={t("evaluation.companyValue1")} />
        <ScoreField name="companyValue2" label={t("evaluation.companyValue2")} />
        <ScoreField name="companyValue3" label={t("evaluation.companyValue3")} />
        <ScoreField name="companyValue4" label={t("evaluation.companyValue4")} />
        <ScoreField name="companyValue5" label={t("evaluation.companyValue5")} />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("evaluation.submitButton")}
      </button>
    </form>
  );
}

export function CreateManualEvaluationForm({ employees }: { employees: Employee[] }) {
  const [error, formAction, isPending] = useActionState(createManualEvaluation, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.preferredName ?? e.fullLegalName} ({e.employeeNumber})
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("evaluation.createManualButton")}
      </button>
    </form>
  );
}

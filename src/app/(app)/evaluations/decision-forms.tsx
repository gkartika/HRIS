"use client";

import { useActionState, useRef, useState } from "react";
import { AttendanceCard, type EvaluationAttendance } from "./attendance-card";
import { releaseEvaluation, submitEvaluation, createManualEvaluation } from "./actions";
import { t } from "@/lib/i18n/id";
import { PERFORMANCE_SCALE, PERFORMANCE_GRADE_NAME, TATA_NILAI_SCALE, performanceField, tataNilaiField, type MatrixDefinition } from "@/lib/evaluation";
import { CriterionCards } from "./criterion-cards";
import { EvaluationGuideButton, guideFromDefinition, type GuideHeader } from "./evaluation-guide";
import type { Employee } from "@/generated/prisma/client";
type EmployeeOption = Pick<Employee, "id" | "fullLegalName" | "employeeNumber">;

export interface VariantChoice {
  key: string;
  label: string;
  suggested: string;
  variants: { key: string; label: string }[];
}

export function ReleaseEvaluationForm({ evaluationId, employees, variantChoices = [] }: { evaluationId: string; employees: EmployeeOption[]; variantChoices?: VariantChoice[] }) {
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
                {e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.p2Label")}</label>
          <select name="p2EmployeeId" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("evaluation.noP2Option")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullLegalName} ({e.employeeNumber})
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
      {variantChoices.length > 0 && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-xs font-semibold text-indigo-900">Standar penilaian yang dipakai</p>
          <p className="mt-0.5 text-xs text-slate-600">Terisi otomatis dari data organisasi (level jabatan dan ada tidaknya bawahan). Ubah hanya bila tidak sesuai.</p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {variantChoices.map((c) => (
              <div key={c.key}>
                <label className="mb-1 block text-xs text-slate-500">{c.label}</label>
                <select name={`variant_${c.key}`} defaultValue={c.suggested} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {c.variants.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
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

export function EvaluationSlotForm({
  evaluationId,
  slot,
  attendance,
  definition,
  hasGuideline,
  guideHeader,
}: {
  evaluationId: string;
  slot: "P1" | "P2";
  attendance: EvaluationAttendance;
  definition: MatrixDefinition;
  hasGuideline: boolean;
  guideHeader: GuideHeader;
}) {
  const action = submitEvaluation.bind(null, evaluationId, slot);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [performance, setPerformance] = useState<Record<string, number | undefined>>({});
  const [tataNilai, setTataNilai] = useState<Record<string, number | undefined>>({});
  const [highlightMissing, setHighlightMissing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const total = definition.performance.length + definition.tataNilai.length;
  const answered = definition.performance.filter((c) => performance[c.key] !== undefined).length + definition.tataNilai.filter((c) => tataNilai[c.key] !== undefined).length;
  const ready = answered === total;
  const hasStandard = [...definition.performance, ...definition.tataNilai].some((c) => c.standard);

  // Pressing the button too early points at what is still missing instead of doing nothing.
  function showMissing() {
    setHighlightMissing(true);
    requestAnimationFrame(() => formRef.current?.querySelector('[data-missing="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <p className="text-sm font-semibold text-slate-900">{t(slot === "P1" ? "evaluation.p1Title" : "evaluation.p2Title")}</p>
      {hasGuideline && (
        <a
          href="/api/evaluation-guideline"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 hover:bg-rose-50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-[11px] font-bold text-rose-700">PDF</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">{t("evaluation.matrix.guidelineTitle")}</span>
            <span className="block text-xs text-slate-500">{t("evaluation.matrix.guidelineHint")}</span>
          </span>
          <span className="text-sm font-bold text-rose-700">{t("evaluation.matrix.guidelineOpen")} ↗</span>
        </a>
      )}
      <AttendanceCard attendance={attendance} hint />
      <CriterionCards
        title={t("evaluation.matrix.performanceTitle")}
        hint={t("evaluation.matrix.performanceHint")}
        criteria={definition.performance}
        scale={PERFORMANCE_SCALE}
        gradeName={PERFORMANCE_GRADE_NAME}
        numbering="letter"
        fieldOf={(k) => performanceField(k)}
        values={performance}
        onPick={(k, n) => setPerformance((p) => ({ ...p, [k]: n }))}
        highlightMissing={highlightMissing}
        toolbar={hasStandard ? <EvaluationGuideButton guide={guideFromDefinition(definition, guideHeader)} /> : undefined}
      />
      <CriterionCards
        title={t("evaluation.matrix.tataNilaiTitle")}
        hint={t("evaluation.matrix.tataNilaiHint")}
        criteria={definition.tataNilai}
        scale={TATA_NILAI_SCALE}
        numbering="number"
        fieldOf={(k) => tataNilaiField(k)}
        values={tataNilai}
        onPick={(k, n) => setTataNilai((p) => ({ ...p, [k]: n }))}
        highlightMissing={highlightMissing}
      />
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <b>{t("evaluation.matrix.progress", { done: answered, total })}</b>
          </p>
          <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-slate-700" role="presentation">
            <div className={`h-full rounded-full ${ready ? "bg-green-500" : "bg-indigo-400"}`} style={{ width: `${Math.round((answered / total) * 100)}%` }} />
          </div>
        </div>
        <button
          type={ready ? "submit" : "button"}
          onClick={ready ? undefined : showMissing}
          disabled={isPending}
          className={`rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60 ${ready ? "bg-indigo-500 text-white hover:bg-indigo-400" : "bg-slate-600 text-slate-200"}`}
        >
          {isPending ? t("common.loading") : ready ? t("evaluation.matrix.send") : t("evaluation.matrix.completeFirst", { n: total - answered })}
        </button>
      </div>
    </form>
  );
}

export function CreateManualEvaluationForm({ employees }: { employees: EmployeeOption[] }) {
  const [error, formAction, isPending] = useActionState(createManualEvaluation, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullLegalName} ({e.employeeNumber})
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

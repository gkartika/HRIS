"use client";

import { useActionState, useRef, useState } from "react";
import { AttendanceCard, type EvaluationAttendance } from "./attendance-card";
import { releaseEvaluation, submitEvaluation, createManualEvaluation } from "./actions";
import { t } from "@/lib/i18n/id";
import { PERFORMANCE_SCALE, TATA_NILAI_SCALE, performanceField, tataNilaiField, type MatrixDefinition } from "@/lib/evaluation";
import type { Employee } from "@/generated/prisma/client";
type EmployeeOption = Pick<Employee, "id" | "fullLegalName" | "employeeNumber">;

export function ReleaseEvaluationForm({ evaluationId, employees }: { evaluationId: string; employees: EmployeeOption[] }) {
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

// One section of the matrix: a row per criterion, a button per grade. On a phone each criterion becomes a card.
function GradeMatrix({
  title,
  hint,
  criteria,
  fieldOf,
  scale,
  values,
  onPick,
  highlightMissing,
}: {
  title: string;
  hint: string;
  criteria: { key: string; label: string }[];
  fieldOf: (key: string) => string;
  scale: readonly number[];
  values: Record<string, number | undefined>;
  onPick: (key: string, n: number) => void;
  highlightMissing: boolean;
}) {
  const cols = { "--n": scale.length } as React.CSSProperties;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" style={cols}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      <div className="mt-3" role="presentation">
        <div className="mb-1 hidden gap-1.5 text-center text-xs font-bold text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(var(--n),56px)]" aria-hidden="true">
          <span />
          {scale.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        {criteria.map(({ key, label }) => {
          const value = values[key];
          const missing = highlightMissing && value === undefined;
          return (
            <fieldset
              key={key}
              data-missing={missing ? "true" : undefined}
              className={`grid grid-cols-[repeat(var(--n),1fr)] items-center gap-1.5 border-0 border-t border-slate-100 py-2 sm:grid-cols-[minmax(0,1fr)_repeat(var(--n),56px)] ${missing ? "rounded-lg bg-amber-50 pl-2 shadow-[inset_3px_0_0_#f59e0b]" : ""}`}
            >
              <legend className="sr-only">{label}</legend>
              <span className="col-span-full mb-1 flex items-start gap-2 text-sm leading-snug text-slate-900 sm:col-span-1 sm:mb-0">
                <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${value === undefined ? "invisible" : "bg-green-600"}`} aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 16 16"><path d="M3.8 8.4l2.7 2.7 5.7-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {label}
              </span>
              {scale.map((n, i) => (
                <label key={n} className="relative block">
                  <input type="radio" name={fieldOf(key)} value={n} checked={value === n} onChange={() => onPick(key, n)} required={i === 0} className="peer sr-only" />
                  <span className="grid h-10 cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-slate-300 bg-white text-sm font-semibold text-slate-600 transition hover:border-indigo-600 hover:text-indigo-600 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:shadow-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600">
                    {n}
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

export function EvaluationSlotForm({
  evaluationId,
  slot,
  attendance,
  definition,
  hasGuideline,
}: {
  evaluationId: string;
  slot: "P1" | "P2";
  attendance: EvaluationAttendance;
  definition: MatrixDefinition;
  hasGuideline: boolean;
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
      <GradeMatrix
        title={t("evaluation.matrix.performanceTitle")}
        hint={t("evaluation.matrix.performanceHint")}
        criteria={definition.performance}
        fieldOf={(k) => performanceField(k)}
        scale={PERFORMANCE_SCALE}
        values={performance}
        onPick={(k, n) => setPerformance((p) => ({ ...p, [k]: n }))}
        highlightMissing={highlightMissing}
      />
      <GradeMatrix
        title={t("evaluation.matrix.tataNilaiTitle")}
        hint={t("evaluation.matrix.tataNilaiHint")}
        criteria={definition.tataNilai}
        fieldOf={(k) => tataNilaiField(k)}
        scale={TATA_NILAI_SCALE}
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

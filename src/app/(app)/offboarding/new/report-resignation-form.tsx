"use client";

import { useActionState } from "react";
import { startOffboarding } from "../actions";
import { t } from "@/lib/i18n/id";
import { FieldError, FormErrorSummary, invalidClass } from "@/components/field-error";
import type { Employee, Position, Job, OrgUnit } from "@/generated/prisma/client";

type EmployeeOption = Employee & { currentPosition: (Position & { job: Job; orgUnit: OrgUnit }) | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportResignationForm({
  employees,
  reasons,
  defaultEmployeeId,
}: {
  employees: EmployeeOption[];
  reasons: { id: string; label: string }[];
  defaultEmployeeId: string;
}) {
  const [state, formAction, isPending] = useActionState(startOffboarding, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <select
          name="employeeId"
          required
          defaultValue={state?.values.employeeId ?? defaultEmployeeId}
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "employeeId")}`}
        >
          <option value="">— Pilih —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullLegalName} ({e.employeeNumber})
              {e.currentPosition ? ` — ${e.currentPosition.job.jobTitle} · ${e.currentPosition.orgUnit.unitName}` : ""}
            </option>
          ))}
        </select>
        <FieldError state={state} name="employeeId" />
      </div>

      <div>
        <label htmlFor="exitReasonId" className="mb-1 block text-xs text-slate-500">
          Alasan *
        </label>
        <select
          id="exitReasonId"
          name="exitReasonId"
          required
          defaultValue={state?.values.exitReasonId ?? ""}
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "exitReasonId")}`}
        >
          <option value="">— Pilih alasan —</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <FieldError state={state} name="exitReasonId" />
        {reasons.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">Belum ada alasan aktif. Tambahkan di Pengaturan &gt; Offboarding &gt; Alasan Keluar.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.lastWorkingDay")}</label>
        <input
          name="lastWorkingDay"
          type="date"
          required
          defaultValue={state?.values.lastWorkingDay ?? todayIso()}
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "lastWorkingDay")}`}
        />
        <FieldError state={state} name="lastWorkingDay" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.managerNote")}</label>
        <textarea
          name="managerNote"
          rows={3}
          defaultValue={state?.values.managerNote ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <FormErrorSummary state={state} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("offboarding.reportButton")}
      </button>
    </form>
  );
}

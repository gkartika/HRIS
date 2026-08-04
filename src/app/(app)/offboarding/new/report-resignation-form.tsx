"use client";

import { useActionState } from "react";
import { reportResignation } from "../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, Position, Job, OrgUnit } from "@/generated/prisma/client";

type EmployeeOption = Employee & { currentPosition: (Position & { job: Job; orgUnit: OrgUnit }) | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportResignationForm({
  employees,
  defaultEmployeeId,
}: {
  employees: EmployeeOption[];
  defaultEmployeeId: string;
}) {
  const [error, formAction, isPending] = useActionState(reportResignation, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <select
          name="employeeId"
          required
          defaultValue={defaultEmployeeId}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Pilih —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.preferredName ?? e.fullLegalName} ({e.employeeNumber})
              {e.currentPosition ? ` — ${e.currentPosition.job.jobTitle} · ${e.currentPosition.orgUnit.unitName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.lastWorkingDay")}</label>
        <input
          name="lastWorkingDay"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("offboarding.managerNote")}</label>
        <textarea name="managerNote" rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
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

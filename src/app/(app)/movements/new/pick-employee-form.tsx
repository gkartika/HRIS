"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/i18n/id";
import type { Employee, Position, Job, OrgUnit } from "@/generated/prisma/client";

type EmployeeOption = Employee & { currentPosition: (Position & { job: Job; orgUnit: OrgUnit }) | null };

// Perubahan Posisi refactor: the entry point from the list page doesn't
// know which employee yet (unlike arriving via that Employee's own detail
// page) — this picker narrows to one, then hands off to the same
// /movements/new?employeeId=... route.
export function PickEmployeeForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (employeeId) router.push(`/movements/new?employeeId=${employeeId}`);
      }}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <select
          required
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
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
        {employees.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">{t("movement.noEligibleEmployees")}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={!employeeId}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {t("common.next")}
      </button>
    </form>
  );
}

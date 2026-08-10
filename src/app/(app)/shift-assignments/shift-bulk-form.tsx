"use client";

import { useActionState, useMemo, useState } from "react";
import { bulkSubmitShiftAssignment } from "./actions";
import { t } from "@/lib/i18n/id";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

const SHIFT_TYPES: ShiftAssignmentType[] = ["SHIFT_1", "SHIFT_2", "SHIFT_3", "NON_SHIFT"];

const SHIFT_BADGE_TONE: Record<ShiftAssignmentType, string> = {
  SHIFT_1: "bg-slate-100 text-slate-600",
  SHIFT_2: "bg-indigo-50 text-indigo-700",
  SHIFT_3: "bg-purple-50 text-purple-700",
  NON_SHIFT: "bg-amber-50 text-amber-700",
};

export interface ShiftEmployeeRow {
  id: string;
  name: string;
  employeeNumber: string;
  departmentName: string;
  jobLevel: string | null;
  currentShiftType: ShiftAssignmentType | null;
  isHrOverride: boolean;
}

// Bulk-first, per direct user request: select any number of employees
// (optionally narrowed by the Department/Level filters above), pick one
// Shift, apply once. A single checked row is just the n=1 case of the same
// flow — there's no separate "edit one person" UI anymore.
export function ShiftBulkForm({
  employees,
  weekStartDateIso,
}: {
  employees: ShiftEmployeeRow[];
  weekStartDateIso: string;
}) {
  const [error, formAction, isPending] = useActionState(bulkSubmitShiftAssignment, undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = employees.length > 0 && employees.every((e) => selected.has(e.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <form action={formAction}>
      <input type="hidden" name="weekStartDate" value={weekStartDateIso} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="employeeIds" value={id} />
      ))}

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("shiftAssignment.pickShift")}</label>
          <select
            name="shiftType"
            defaultValue="SHIFT_1"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {SHIFT_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`shiftAssignmentType.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs text-slate-500">{t("shiftAssignment.note")}</label>
          <input
            name="note"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || selectedIds.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {isPending
            ? t("common.loading")
            : t("shiftAssignment.applyToSelected", { count: selectedIds.length })}
        </button>
        {error && <p className="w-full text-xs text-rose-600">{error}</p>}
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-slate-400">{t("shiftAssignment.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t("shiftAssignment.selectAll")} />
                </th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.department")}</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">{t("shiftAssignment.currentShift")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleOne(e.id)}
                      aria-label={e.name}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {e.name}
                    <span className="block text-xs text-slate-400">{e.employeeNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.departmentName}</td>
                  <td className="px-4 py-3 text-slate-600">{e.jobLevel ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${SHIFT_BADGE_TONE[e.currentShiftType ?? "SHIFT_1"]}`}
                    >
                      {t(`shiftAssignmentType.${e.currentShiftType ?? "SHIFT_1"}`)}
                      {!e.currentShiftType && ` (${t("shiftAssignment.defaultBadge")})`}
                    </span>
                    {e.isHrOverride && (
                      <span className="ml-2 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {t("shiftAssignment.hrOverrideBadge")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}

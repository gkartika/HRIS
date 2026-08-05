"use client";

import { useActionState } from "react";
import { submitShiftAssignment } from "./actions";
import { t } from "@/lib/i18n/id";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

const SHIFT_TYPES: ShiftAssignmentType[] = ["SHIFT_1", "SHIFT_2", "SHIFT_3", "NON_SHIFT"];

export function ShiftRowForm({
  employeeId,
  weekStartDateIso,
  currentShiftType,
  currentNote,
}: {
  employeeId: string;
  weekStartDateIso: string;
  currentShiftType: ShiftAssignmentType | null;
  currentNote: string | null;
}) {
  const [error, formAction, isPending] = useActionState(submitShiftAssignment, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="weekStartDate" value={weekStartDateIso} />
      <select
        name="shiftType"
        defaultValue={currentShiftType ?? ""}
        required
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      >
        <option value="" disabled>
          — {t("shiftAssignment.pickShift")} —
        </option>
        {SHIFT_TYPES.map((s) => (
          <option key={s} value={s}>
            {t(`shiftAssignmentType.${s}`)}
          </option>
        ))}
      </select>
      <input
        name="note"
        defaultValue={currentNote ?? ""}
        placeholder={t("shiftAssignment.note")}
        className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("common.save")}
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

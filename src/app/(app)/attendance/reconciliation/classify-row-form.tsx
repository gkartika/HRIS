"use client";

import { useActionState } from "react";
import { classifyAttendanceDay } from "./actions";
import { PRESENT_OVERRIDE_SENTINEL } from "./present-override";

export interface AbsenceTypeOption {
  code: string;
  label: string;
}

const SHIFT_OPTIONS = [
  { value: "SHIFT_1", label: "M1" },
  { value: "SHIFT_2", label: "M2" },
  { value: "SHIFT_3", label: "M3" },
  { value: "NON_SHIFT", label: "L" },
];

// Per direct request: an entry needs BOTH a shift and a category together —
// a category picked with no shift never counts toward Total Jam Kerja
// (attendance-hours.ts), since there's no schedule to look the hours up
// against. The shift defaults to this employee's normal weekly
// ShiftAssignment so most entries need no extra thought, but it's still an
// explicit, submitted field, never silently assumed.
export function ClassifyRowForm({
  employeeId,
  dateParam,
  assignedShiftType,
  absenceTypes,
}: {
  employeeId: string;
  dateParam: string;
  assignedShiftType: string;
  absenceTypes: AbsenceTypeOption[];
}) {
  const [error, formAction, isPending] = useActionState(classifyAttendanceDay, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="date" value={dateParam} />
      <select name="shiftType" required defaultValue={assignedShiftType} className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700">
        {SHIFT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        name="absenceTypeCode"
        required
        defaultValue=""
        className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
      >
        <option value="" disabled>
          Pilih kode…
        </option>
        <option value={PRESENT_OVERRIDE_SENTINEL}>Masuk (Lupa Absen)</option>
        {absenceTypes.map((t) => (
          <option key={t.code} value={t.code}>
            {t.code} — {t.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {isPending ? "Menyimpan…" : "Simpan"}
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

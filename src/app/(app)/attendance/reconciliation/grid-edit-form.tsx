"use client";

import { useActionState } from "react";
import { classifyAttendanceDay } from "./actions";
import type { AbsenceTypeOption } from "./classify-row-form";
import { PRESENT_OVERRIDE_SENTINEL } from "./present-override";

const SHIFT_OPTIONS = [
  { value: "SHIFT_1", label: "M1 — Shift 1" },
  { value: "SHIFT_2", label: "M2 — Shift 2" },
  { value: "SHIFT_3", label: "M3 — Shift 3" },
  { value: "NON_SHIFT", label: "L — Libur / Non-Shift" },
];

export function GridEditForm({
  employeeId,
  employeeName,
  dateParam,
  dateLabel,
  currentAbsenceTypeCode,
  currentShiftType,
  currentPresentOverride,
  absenceTypes,
}: {
  employeeId: string;
  employeeName: string;
  dateParam: string;
  dateLabel: string;
  currentAbsenceTypeCode: string | null;
  currentShiftType: string | null;
  currentPresentOverride: boolean;
  absenceTypes: AbsenceTypeOption[];
}) {
  const [error, formAction, isPending] = useActionState(classifyAttendanceDay, undefined);

  return (
    <div className="rounded-xl border border-brand-accent bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">
        {employeeName} — {dateLabel}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">Tetapkan atau timpa klasifikasi hari ini.</p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="date" value={dateParam} />
        <div>
          <label className="mb-1 block text-xs text-slate-500">Shift</label>
          <select name="shiftType" defaultValue={currentShiftType ?? ""} className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">—</option>
            {SHIFT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Kode Absensi</label>
          <select
            name="absenceTypeCode"
            defaultValue={currentPresentOverride ? PRESENT_OVERRIDE_SENTINEL : currentAbsenceTypeCode ?? ""}
            className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value={PRESENT_OVERRIDE_SENTINEL}>Masuk (Lupa Absen)</option>
            {absenceTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-grow">
          <label className="mb-1 block text-xs text-slate-500">Catatan (opsional)</label>
          <input name="note" type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {isPending ? "Menyimpan…" : "Simpan"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

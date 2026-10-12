"use client";

import { useActionState } from "react";
import { updateWorkSchedule } from "./actions";
import { formatMinutesAsHours } from "@/lib/attendance-hours";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface WorkScheduleRow {
  shiftType: string;
  shiftLabel: string;
  minutesByDay: number[]; // index 0=Sunday..6=Saturday
  startTime: string; // "HH:MM" or empty when not set
  graceMinutes: number;
}

export function WorkScheduleRowForm({ row }: { row: WorkScheduleRow }) {
  const action = updateWorkSchedule.bind(null, row.shiftType);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="w-24 shrink-0 text-sm font-semibold text-slate-900">{row.shiftLabel}</p>
        {DAY_LABELS.map((label, day) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <label className="text-[11px] text-slate-500">{label}</label>
            <input
              name={`minutes_${day}`}
              type="number"
              min={0}
              step={15}
              defaultValue={row.minutesByDay[day]}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm"
            />
            <span className="text-[10px] text-slate-400">{formatMinutesAsHours(row.minutesByDay[day])}</span>
          </div>
        ))}
        {row.shiftType !== "NON_SHIFT" && (
          <>
            <div className="flex flex-col items-center gap-1">
              <label className="text-[11px] text-slate-500" htmlFor={`start_${row.shiftType}`}>
                Jam mulai
              </label>
              <input
                id={`start_${row.shiftType}`}
                name="startTime"
                type="time"
                defaultValue={row.startTime}
                className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm"
              />
              <span className="text-[10px] text-slate-400">kosong = tidak dicek</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <label className="text-[11px] text-slate-500" htmlFor={`grace_${row.shiftType}`}>
                Toleransi (menit)
              </label>
              <input
                id={`grace_${row.shiftType}`}
                name="graceMinutes"
                type="number"
                min={0}
                max={120}
                step={1}
                defaultValue={row.graceMinutes}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm"
              />
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "..." : "Simpan"}
        </button>
        {error && <span className="w-full text-xs text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

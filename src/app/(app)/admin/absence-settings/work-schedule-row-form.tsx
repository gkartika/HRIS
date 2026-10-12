"use client";

import { useActionState, useState } from "react";
import { updateWorkSchedule } from "./actions";
import { formatMinutesAsHours } from "@/lib/attendance-hours";
import { addMinutesToTime } from "@/lib/attendance";

// Sunday first, like the company week (Sunday to Saturday) and the stored dayOfWeek.
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface WorkScheduleRow {
  shiftType: string;
  shiftLabel: string;
  minutesByDay: number[]; // index 0=Sunday..6=Saturday
  startByDay: string[]; // "HH:MM" or "" when not set, same index
  graceMinutes: number;
}

// One card per shift: working minutes and start time for each weekday, and the
// one grace (toleransi) the whole shift shares. The two right-hand columns are
// worked out live so the numbers can be checked before saving.
export function WorkScheduleRowForm({ row }: { row: WorkScheduleRow }) {
  const action = updateWorkSchedule.bind(null, row.shiftType);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [minutes, setMinutes] = useState(row.minutesByDay.map(String));
  const [starts, setStarts] = useState(row.startByDay);
  const [grace, setGrace] = useState(String(row.graceMinutes));
  const hasStart = row.shiftType !== "NON_SHIFT";
  const graceNumber = Number(grace) || 0;

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{row.shiftLabel}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Hari</th>
              <th className="py-1.5 pr-3 font-medium">Menit kerja</th>
              {hasStart && (
                <>
                  <th className="py-1.5 pr-3 font-medium">Jam masuk</th>
                  <th className="py-1.5 pr-3 font-medium">Terlambat setelah</th>
                  <th className="py-1.5 font-medium">Setengah Hari mulai</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((label, day) => {
              const dayMinutes = Number(minutes[day]) || 0;
              const start = dayMinutes > 0 ? starts[day] : "";
              return (
                <tr key={label} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-700">{label}</td>
                  <td className="py-1.5 pr-3">
                    <input
                      name={`minutes_${day}`}
                      type="number"
                      min={0}
                      step={15}
                      value={minutes[day]}
                      onChange={(e) => setMinutes((m) => m.map((v, i) => (i === day ? e.target.value : v)))}
                      aria-label={`Menit kerja ${label}`}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm"
                    />{" "}
                    <span className="text-xs text-slate-400">{formatMinutesAsHours(dayMinutes)}</span>
                  </td>
                  {hasStart && (
                    <>
                      <td className="py-1.5 pr-3">
                        {dayMinutes > 0 ? (
                          <input
                            name={`start_${day}`}
                            type="time"
                            value={starts[day]}
                            onChange={(e) => setStarts((s) => s.map((v, i) => (i === day ? e.target.value : v)))}
                            aria-label={`Jam masuk ${label}`}
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">libur</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-600">{start ? addMinutesToTime(start, graceNumber) : "—"}</td>
                      <td className="py-1.5 font-semibold text-amber-800">{start ? addMinutesToTime(start, Math.ceil(dayMinutes / 2)) : "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {hasStart && (
          <>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Toleransi (menit)
              <input
                name="graceMinutes"
                type="number"
                min={0}
                max={120}
                step={1}
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => setStarts((s) => s.map((v, i) => (i >= 2 && i <= 4 ? s[1] : v)))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Samakan Sel–Kam dengan hari Senin
            </button>
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

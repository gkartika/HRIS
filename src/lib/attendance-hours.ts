// Total Jam Kerja (working hours) — pure business logic, no Prisma import,
// same pattern as evaluation.ts/competency.ts. The schedule itself
// (minutes per Shift per day-of-week) lives in WorkScheduleConfig, admin-
// configurable per direct request ("need to be able to configure within
// the apps if we decided to change it") — never hardcoded here.

export function formatMinutesAsHours(minutes: number): string {
  if (minutes <= 0) return "0j";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}j` : `${h}j ${m}m`;
}

export interface DayHoursInput {
  dayOfWeek: number; // 0=Sunday..6=Saturday, matches Date.getUTCDay()
  /** A check-in is enough to count the day as worked; no check-out is needed (decided 2026-10-12). */
  hasCheckIn: boolean;
  /** Shift explicitly carried by this day's own classification entry, if any. */
  recordShiftType: string | null;
  /** This employee's normal weekly ShiftAssignment (or the app-wide default). */
  assignedShiftType: string;
  absenceTypeCode: string | null;
  /** hoursMultiplier looked up for absenceTypeCode — 0 when absenceTypeCode is null. */
  hoursMultiplier: number;
  /** HR manually confirmed this day as present despite no punch (forgotten scan) — counts like a real present day. */
  presentOverride: boolean;
}

// "Jam Kerja Aktual" — hours actually physically worked: a real check-in
// (the check-out is not needed; the hours are the shift's scheduled minutes
// and never more than that), or a "Masuk" presentOverride (HR's determination that they
// were genuinely present despite no punch). Excludes paid-absence credit
// entirely, unlike computeDayMinutes below — per direct request, this is
// the "real working hours" figure, distinct from what payroll pays for.
export function computeActualDayMinutes(input: DayHoursInput, scheduleMinutesFor: (shiftType: string, dayOfWeek: number) => number): number {
  if (input.presentOverride || input.hasCheckIn) {
    const shift = input.recordShiftType ?? input.assignedShiftType;
    return scheduleMinutesFor(shift, input.dayOfWeek);
  }
  return 0;
}

// "Jam Kerja Gaji" — what payroll actually pays for. Per direct request:
// "the entry of this will be shift and its category — if only category [is
// entered], don't count." A paid-absence day (SDSD, IK, SH/half-day, ...)
// only contributes hours when the classification itself explicitly carried
// a shift — falling back to the employee's usual weekly assignment is
// deliberately NOT done here, unlike a present day, since there's no punch
// to corroborate which schedule applies. Every non-absence day (present or
// not) is identical to computeActualDayMinutes above.
export function computeDayMinutes(input: DayHoursInput, scheduleMinutesFor: (shiftType: string, dayOfWeek: number) => number): number {
  if (input.absenceTypeCode) {
    if (!input.recordShiftType || input.hoursMultiplier <= 0) return 0;
    return Math.round(scheduleMinutesFor(input.recordShiftType, input.dayOfWeek) * input.hoursMultiplier);
  }
  return computeActualDayMinutes(input, scheduleMinutesFor);
}

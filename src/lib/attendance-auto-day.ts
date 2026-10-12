// Late check-ins, decided automatically at check-in (2026-10-12, revised the
// same day): a check-in that comes after the shift's start plus its grace is
// "late". How late decides the day, with no need to wait for the check-out:
//   - late by less than half of the shift's scheduled time: still a full day,
//   - late by half of it or more (4 hours on an 8-hour shift): Setengah Hari (SH).
// A check-in outside every registered location is only flagged for Admin SDM;
// it never changes hours or points. Pure logic, no Prisma/Next imports, so it
// is unit testable.
import { companyDateParts, companyToday } from "@/lib/company-time";
import { parseStartMinutes, type ShiftStart } from "@/lib/attendance";
import { punchDayKey } from "@/lib/punch-days";
import { normalizeWeekStart } from "@/lib/shift-assignment";

export type AutoDayKind = "FULL" | "HALF";

export interface AutoDayVerdict {
  employeeId: string;
  /** The company (WIB) day, as a UTC-midnight date. */
  date: Date;
  kind: AutoDayKind;
  /** Somebody already decided this day (absence code, "Masuk", shift-only); the automatic outcome is then only informational. */
  decided: boolean;
  late: boolean;
  outsideLocation: boolean;
  /** Minutes the first check-in came after the shift's start (0 when on time or no start time is set). */
  lateMinutes: number;
  /** From this many minutes late the day becomes a half day: half of the scheduled minutes. */
  halfDayAfterMinutes: number;
  /** The shift's scheduled minutes for that weekday. */
  scheduledMinutes: number;
  /** The shift the day was judged against. */
  shiftType: string;
}

// Full day until the check-in is half of the schedule or more after the start.
export function classifyByLateness(lateMinutes: number, scheduledMinutes: number): AutoDayKind {
  return scheduledMinutes > 0 && lateMinutes * 2 >= scheduledMinutes ? "HALF" : "FULL";
}

export interface AutoDayEvent {
  employeeId: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  eventAt: Date;
  /** null for events with no location (fingerprint). */
  withinGeofence: boolean | null;
}

// A day somebody already decided: an absence code, "Masuk", or a shift-only
// confirmation. Those are never overridden by the automatic rule.
export interface DecidedDay {
  employeeId: string;
  attendanceDate: Date;
  absenceTypeCode: string | null;
  presentOverride: boolean;
  shiftType: string | null;
}

export interface AutoDayInput {
  events: AutoDayEvent[];
  decidedDays: DecidedDay[];
  assignedShiftFor: (employeeId: string, weekStart: Date) => string;
  scheduleMinutesFor: (shiftType: string, dayOfWeek: number) => number;
  startFor: (shiftType: string) => ShiftStart | undefined;
  /** UTC-midnight times of public holidays; those days are left alone. */
  holidayTimes: Set<number>;
}

// One verdict per flagged employee-day (late, or checked in outside a
// location), keyed like punchDayKey. A day somebody already decided is marked
// `decided`; consumers that change hours or points skip those.
export function buildAutoDayVerdicts(input: AutoDayInput): Map<string, AutoDayVerdict> {
  const decided = new Map(input.decidedDays.map((d) => [punchDayKey(d.employeeId, d.attendanceDate), d]));

  const byDay = new Map<string, { employeeId: string; day: Date; events: AutoDayEvent[] }>();
  for (const event of input.events) {
    const day = companyToday(event.eventAt);
    const key = punchDayKey(event.employeeId, day);
    const entry = byDay.get(key) ?? { employeeId: event.employeeId, day, events: [] };
    entry.events.push(event);
    byDay.set(key, entry);
  }

  const verdicts = new Map<string, AutoDayVerdict>();
  for (const [key, { employeeId, day, events }] of byDay) {
    if (input.holidayTimes.has(day.getTime())) continue;

    const shiftType = input.assignedShiftFor(employeeId, normalizeWeekStart(day));
    const scheduledMinutes = input.scheduleMinutesFor(shiftType, day.getUTCDay());
    if (scheduledMinutes <= 0) continue;

    const checkIns = events.filter((e) => e.eventType === "CHECK_IN");
    const start = input.startFor(shiftType);
    const startMinutes = parseStartMinutes(start?.startTime);
    let lateMinutes = 0;
    let late = false;
    if (checkIns.length > 0 && startMinutes !== null) {
      const first = companyDateParts(new Date(Math.min(...checkIns.map((e) => e.eventAt.getTime()))));
      const checkInMinutes = first.hour * 60 + first.minute;
      lateMinutes = Math.max(0, checkInMinutes - startMinutes);
      late = checkInMinutes > startMinutes + (start?.graceMinutes ?? 0);
    }
    const outsideLocation = events.some((e) => e.withinGeofence === false);
    if (!late && !outsideLocation) continue;

    const decision = decided.get(key);
    verdicts.set(key, {
      employeeId,
      date: day,
      kind: late ? classifyByLateness(lateMinutes, scheduledMinutes) : "FULL",
      decided: !!decision && !!(decision.absenceTypeCode || decision.presentOverride || decision.shiftType),
      late,
      outsideLocation,
      lateMinutes,
      halfDayAfterMinutes: Math.ceil(scheduledMinutes / 2),
      scheduledMinutes,
      shiftType,
    });
  }
  return verdicts;
}

// "Terlambat", "Di luar lokasi" or both, for labels and reasons.
export function autoReasonLabel(v: Pick<AutoDayVerdict, "late" | "outsideLocation">): string {
  if (v.late && v.outsideLocation) return "Terlambat dan di luar lokasi";
  return v.late ? "Terlambat" : "Di luar lokasi";
}

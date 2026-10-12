// Loads what the automatic late / out-of-location rule needs (punches with
// time and place, decisions already made, shifts and their start times) and
// returns one verdict per flagged employee-day. See attendance-auto-day.ts.
import { prisma } from "@/lib/db";
import { startOfCompanyDay } from "@/lib/company-time";
import { buildAutoDayVerdicts, type AutoDayVerdict } from "@/lib/attendance-auto-day";
import { buildAssignedShiftLookup, buildScheduleMinutesLookup, normalizeWeekStart } from "@/lib/shift-assignment";
import type { ShiftStart } from "@/lib/attendance";

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildShiftStartLookup(rows: { shiftType: string; startTime: string | null; graceMinutes: number }[]): (shiftType: string) => ShiftStart | undefined {
  const byShift = new Map(rows.map((r) => [r.shiftType, { startTime: r.startTime, graceMinutes: r.graceMinutes }]));
  return (shiftType) => byShift.get(shiftType);
}

// Verdicts for the days in [start, end) (both UTC-midnight dates). Without
// `employeeIds` it covers every active employee.
export async function loadAutoDayVerdicts(args: { start: Date; end: Date; employeeIds?: string[] }): Promise<Map<string, AutoDayVerdict>> {
  const { start, end, employeeIds } = args;
  if (end <= start || (employeeIds && employeeIds.length === 0)) return new Map();

  const weekStarts = [...new Set(
    Array.from({ length: Math.round((end.getTime() - start.getTime()) / DAY_MS) }, (_, i) => normalizeWeekStart(new Date(start.getTime() + i * DAY_MS)).getTime())
  )].map((t) => new Date(t));
  const employeeFilter = employeeIds ? { employeeId: { in: employeeIds } } : { employee: { activeFlag: true } };

  const [events, decidedDays, shiftAssignments, workSchedule, startRows, holidays] = await Promise.all([
    prisma.attendanceEvent.findMany({
      where: {
        ...employeeFilter,
        eventType: { in: ["CHECK_IN", "CHECK_OUT"] },
        eventAt: { gte: startOfCompanyDay(start), lt: startOfCompanyDay(end) },
      },
      select: { employeeId: true, eventType: true, eventAt: true, withinGeofence: true },
    }),
    prisma.dailyAttendanceRecord.findMany({
      where: {
        ...employeeFilter,
        attendanceDate: { gte: start, lt: end },
        OR: [{ absenceTypeCode: { not: null } }, { presentOverride: true }, { shiftType: { not: null } }],
      },
      select: { employeeId: true, attendanceDate: true, absenceTypeCode: true, presentOverride: true, shiftType: true },
    }),
    prisma.shiftAssignment.findMany({ where: { ...employeeFilter, weekStartDate: { in: weekStarts } } }),
    prisma.workScheduleConfig.findMany(),
    prisma.shiftStartConfig.findMany(),
    prisma.companyHoliday.findMany({ where: { date: { gte: start, lt: end } }, select: { date: true } }),
  ]);

  return buildAutoDayVerdicts({
    events: events.map((e) => ({ ...e, eventType: e.eventType as "CHECK_IN" | "CHECK_OUT" })),
    decidedDays,
    assignedShiftFor: buildAssignedShiftLookup(shiftAssignments),
    scheduleMinutesFor: buildScheduleMinutesLookup(workSchedule),
    startFor: buildShiftStartLookup(startRows),
    holidayTimes: new Set(holidays.map((h) => h.date.getTime())),
  });
}

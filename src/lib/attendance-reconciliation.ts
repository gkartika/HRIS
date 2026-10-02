import { prisma } from "@/lib/db";
import { companyToday } from "@/lib/company-time";
import { normalizeWeekStart, buildIsScheduledToWorkLookup } from "@/lib/shift-assignment";

const LOOKBACK_DAYS = 14;

// UTC-midnight "date-only" value — same convention as shift-assignment.ts's
// normalizeWeekStart. A plain local-midnight Date would store a different
// instant depending on which timezone the server process happens to run
// in, silently drifting DailyAttendanceRecord rows out of sync with each
// other across environments/restarts.
function startOfDay(date: Date): Date {
  return companyToday(date);
}

// Idempotent daily reconciliation trigger — same "derive/act on read"
// pattern as triggerDueRenewalCases() (src/app/(app)/contracts/renewal-actions.ts),
// fired on every visit to the Attendance records page rather than a
// separate cron. Populates one DailyAttendanceRecord per employee per
// completed working day, linking whichever CHECK_IN/CHECK_OUT events exist
// for that day — a marker of "this day has been swept", not the source of
// exception data itself (exceptions are always derived live, see
// deriveDailyAttendanceExceptions in lib/attendance.ts, against the one
// fixed company default schedule).
//
// Documented simplification: only scans the last LOOKBACK_DAYS days and only
// each employee's CURRENT AttendanceAssignment, not a full effective-dated
// assignment history — acceptable since the trigger runs on every visit and
// self-heals forward, same class of simplification as work-calendar.ts's
// Mon-Fri-only calendar.
//
// Performance note: this used to check/create one (employee, day) pair at a
// time in a nested loop — up to `assignments.length * LOOKBACK_DAYS`
// sequential awaited round trips on every single page load (e.g. 184
// employees × 14 days = 2576 round trips once the company is fully
// onboarded). Rewritten to batch: one query for existing records, one each
// for check-in/check-out events across the whole window, then a single
// createMany for whatever's still missing — a handful of round trips total
// regardless of how many employees/days are due.
export async function reconcileDueDailyAttendance(): Promise<void> {
  const today = startOfDay(new Date());
  const assignments = await prisma.attendanceAssignment.findMany({
    where: { effectiveTo: null },
  });
  if (assignments.length === 0) return;

  // Every calendar day in the window is a candidate; whether an employee was
  // actually due to work that day is decided per employee below (shift
  // schedule, Libur, company holidays) rather than a fixed Mon-Fri rule.
  const candidateDays: Date[] = [];
  for (let offset = 1; offset <= LOOKBACK_DAYS; offset++) {
    candidateDays.push(new Date(today.getTime() - offset * 24 * 60 * 60 * 1000));
  }
  const windowStart = candidateDays[candidateDays.length - 1];

  const employeeIds = [...new Set(assignments.map((a) => a.employeeId))];
  const keyOf = (employeeId: string, day: Date) => `${employeeId}|${day.getTime()}`;

  const weekStarts = [...new Set(candidateDays.map((d) => normalizeWeekStart(d).getTime()))].map((t) => new Date(t));
  const [existingRecords, checkInEvents, checkOutEvents, shiftAssignments, scheduleRows, holidays] = await Promise.all([
    prisma.dailyAttendanceRecord.findMany({
      where: { employeeId: { in: employeeIds }, attendanceDate: { gte: windowStart, lt: today } },
      select: { employeeId: true, attendanceDate: true },
    }),
    prisma.attendanceEvent.findMany({
      where: { employeeId: { in: employeeIds }, eventType: "CHECK_IN", eventAt: { gte: windowStart, lt: today } },
      select: { id: true, employeeId: true, eventAt: true },
    }),
    prisma.attendanceEvent.findMany({
      where: { employeeId: { in: employeeIds }, eventType: "CHECK_OUT", eventAt: { gte: windowStart, lt: today } },
      select: { id: true, employeeId: true, eventAt: true },
    }),
    prisma.shiftAssignment.findMany({ where: { employeeId: { in: employeeIds }, weekStartDate: { in: weekStarts } } }),
    prisma.workScheduleConfig.findMany(),
    prisma.companyHoliday.findMany({ where: { date: { gte: windowStart, lt: today } }, select: { date: true } }),
  ]);

  const existingKeys = new Set(existingRecords.map((r) => keyOf(r.employeeId, r.attendanceDate)));
  const checkInByKey = new Map(checkInEvents.map((e) => [keyOf(e.employeeId, startOfDay(e.eventAt)), e.id]));
  const checkOutByKey = new Map(checkOutEvents.map((e) => [keyOf(e.employeeId, startOfDay(e.eventAt)), e.id]));
  const isScheduled = buildIsScheduledToWorkLookup(holidays, scheduleRows, shiftAssignments);

  const toCreate: { employeeId: string; attendanceDate: Date; checkInEventId?: string; checkOutEventId?: string }[] = [];
  for (const assignment of assignments) {
    const assignmentStart = startOfDay(assignment.effectiveFrom);
    for (const day of candidateDays) {
      if (day < assignmentStart) continue;
      const key = keyOf(assignment.employeeId, day);
      if (existingKeys.has(key)) continue;
      const checkInEventId = checkInByKey.get(key);
      const checkOutEventId = checkOutByKey.get(key);
      // Someone who punched on a day off (e.g. worked a Libur day) still gets a record.
      if (!isScheduled(assignment.employeeId, day) && !checkInEventId && !checkOutEventId) continue;
      toCreate.push({ employeeId: assignment.employeeId, attendanceDate: day, checkInEventId, checkOutEventId });
    }
  }

  if (toCreate.length > 0) {
    await prisma.dailyAttendanceRecord.createMany({ data: toCreate, skipDuplicates: true });
  }
}

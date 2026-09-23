import { prisma } from "@/lib/db";
import { isWorkingDay } from "@/lib/attendance";

const LOOKBACK_DAYS = 14;

// UTC-midnight "date-only" value — same convention as shift-assignment.ts's
// normalizeWeekStart. A plain local-midnight Date would store a different
// instant depending on which timezone the server process happens to run
// in, silently drifting DailyAttendanceRecord rows out of sync with each
// other across environments/restarts.
function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
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

  const dueDays: Date[] = [];
  for (let offset = 1; offset <= LOOKBACK_DAYS; offset++) {
    const day = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    if (isWorkingDay(day)) dueDays.push(day);
  }
  if (dueDays.length === 0) return;
  const windowStart = dueDays[dueDays.length - 1];

  const duePairs: { employeeId: string; day: Date }[] = [];
  for (const assignment of assignments) {
    const assignmentStart = startOfDay(assignment.effectiveFrom);
    for (const day of dueDays) {
      if (day < assignmentStart) continue;
      duePairs.push({ employeeId: assignment.employeeId, day });
    }
  }
  if (duePairs.length === 0) return;

  const employeeIds = [...new Set(duePairs.map((p) => p.employeeId))];
  const keyOf = (employeeId: string, day: Date) => `${employeeId}|${day.getTime()}`;

  const [existingRecords, checkInEvents, checkOutEvents] = await Promise.all([
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
  ]);

  const existingKeys = new Set(existingRecords.map((r) => keyOf(r.employeeId, r.attendanceDate)));
  const checkInByKey = new Map(checkInEvents.map((e) => [keyOf(e.employeeId, startOfDay(e.eventAt)), e.id]));
  const checkOutByKey = new Map(checkOutEvents.map((e) => [keyOf(e.employeeId, startOfDay(e.eventAt)), e.id]));

  const toCreate = duePairs
    .filter((p) => !existingKeys.has(keyOf(p.employeeId, p.day)))
    .map((p) => ({
      employeeId: p.employeeId,
      attendanceDate: p.day,
      checkInEventId: checkInByKey.get(keyOf(p.employeeId, p.day)),
      checkOutEventId: checkOutByKey.get(keyOf(p.employeeId, p.day)),
    }));

  if (toCreate.length > 0) {
    await prisma.dailyAttendanceRecord.createMany({ data: toCreate, skipDuplicates: true });
  }
}

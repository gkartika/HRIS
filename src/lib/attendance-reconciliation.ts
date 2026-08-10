import { prisma } from "@/lib/db";
import { isWorkingDay } from "@/lib/attendance";

const LOOKBACK_DAYS = 14;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
export async function reconcileDueDailyAttendance(): Promise<void> {
  const today = startOfDay(new Date());
  const assignments = await prisma.attendanceAssignment.findMany({
    where: { effectiveTo: null },
  });

  for (const assignment of assignments) {
    const assignmentStart = startOfDay(assignment.effectiveFrom);
    for (let offset = 1; offset <= LOOKBACK_DAYS; offset++) {
      const day = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      if (day < assignmentStart) continue;
      if (!isWorkingDay(day)) continue;

      const existing = await prisma.dailyAttendanceRecord.findUnique({
        where: { employeeId_attendanceDate: { employeeId: assignment.employeeId, attendanceDate: day } },
      });
      if (existing) continue;

      const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const [checkIn, checkOut] = await Promise.all([
        prisma.attendanceEvent.findFirst({
          where: { employeeId: assignment.employeeId, eventType: "CHECK_IN", eventAt: { gte: day, lt: dayEnd } },
        }),
        prisma.attendanceEvent.findFirst({
          where: { employeeId: assignment.employeeId, eventType: "CHECK_OUT", eventAt: { gte: day, lt: dayEnd } },
        }),
      ]);

      await prisma.dailyAttendanceRecord.create({
        data: {
          employeeId: assignment.employeeId,
          attendanceDate: day,
          checkInEventId: checkIn?.id,
          checkOutEventId: checkOut?.id,
        },
      });
    }
  }
}

import { prisma } from "@/lib/db";
import { DAY_MS } from "@/lib/company-time";
import { scheduledDaysInRange } from "@/lib/absence";
import { buildIsScheduledToWorkLookup, normalizeWeekStart } from "@/lib/shift-assignment";

// "Is this employee scheduled to work this day", for every day in a range and
// a set of employees: their weekly shift (default Shift 1), the company work
// schedule per shift and weekday, and the holiday calendar (Tanggal Merah and
// Cuti Bersama are never working days). Loaded once so a list of requests
// does not query per request.
export async function loadScheduledDayLookup(
  employeeIds: string[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<(employeeId: string, day: Date) => boolean> {
  const firstWeek = normalizeWeekStart(rangeStart);
  const [holidays, scheduleRows, shiftAssignments] = await Promise.all([
    prisma.companyHoliday.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      select: { date: true },
    }),
    prisma.workScheduleConfig.findMany(),
    employeeIds.length > 0
      ? prisma.shiftAssignment.findMany({
          where: { employeeId: { in: employeeIds }, weekStartDate: { gte: firstWeek, lte: rangeEnd } },
          select: { employeeId: true, weekStartDate: true, shiftType: true },
        })
      : Promise.resolve([]),
  ]);
  return buildIsScheduledToWorkLookup(holidays, scheduleRows, shiftAssignments);
}

// Working days used by each leave request (request id -> days), for the
// request page and the dashboard lists.
export async function scheduledDayCountsForRequests(
  requests: { id: string; employeeId: string; startDate: Date; endDate: Date }[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (requests.length === 0) return counts;
  const rangeStart = new Date(Math.min(...requests.map((r) => r.startDate.getTime())));
  const rangeEnd = new Date(Math.max(...requests.map((r) => r.endDate.getTime())) + DAY_MS);
  const isScheduled = await loadScheduledDayLookup([...new Set(requests.map((r) => r.employeeId))], rangeStart, rangeEnd);
  for (const r of requests) {
    counts.set(r.id, scheduledDaysInRange(isScheduled, r.employeeId, r.startDate, r.endDate).length);
  }
  return counts;
}

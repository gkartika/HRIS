import { prisma } from "@/lib/db";
import { companyYear } from "@/lib/company-time";
import { scheduledDaysInRange } from "@/lib/absence";
import { loadScheduledDayLookup } from "@/lib/leave-days";

/**
 * Resolves the effective annual-days quota for one employee/type pair: an
 * HR-Admin-set AbsenceQuotaOverride if one exists, else the company-wide
 * AbsenceEntitlementConfig default for that type. `0` is a real, enforced
 * quota of zero days (e.g. Cuti defaults to 0 since not everyone is
 * entitled to it — HR Admin grants an actual quota per person via the
 * override). `null` means unlimited / not configured at all — the absence
 * of a row entirely, not a stored 0.
 */
export async function resolveAnnualQuota(employeeId: string, absenceTypeCode: string): Promise<number | null> {
  const override = await prisma.absenceQuotaOverride.findUnique({
    where: { employeeId_absenceTypeCode: { employeeId, absenceTypeCode } },
  });
  if (override) return override.annualDays;

  const config = await prisma.absenceEntitlementConfig.findUnique({ where: { absenceTypeCode } });
  return config ? config.annualDays : null;
}

/**
 * The distinct days this employee has used, per absence type, since Jan 1 of
 * the current year. Two sources feed it:
 *  - APPROVED requests: only the days that are real working days for the
 *    employee (weekends, days off and public holidays do not use up leave);
 *  - days HR directly classified with a type via Rekonsiliasi Absensi
 *    (DailyAttendanceRecord.absenceTypeCode), which deduct quota immediately
 *    with no request or approval, so the classified day itself is the record.
 * Days are collected in a Set, so a day covered by both an approved request
 * and an HR classification of the same type is counted once, not twice
 * (decided 2026-10-08). `excludeRequestId` lets a request's own detail page
 * compute "used before this one" without counting itself once approved.
 */
async function collectUsedDays(
  employeeId: string,
  options: { absenceTypeCode?: string; excludeRequestId?: string }
): Promise<Map<string, Set<number>>> {
  const yearStart = new Date(Date.UTC(companyYear(), 0, 1));
  const [requests, classifiedDays] = await Promise.all([
    prisma.absenceRequest.findMany({
      where: {
        employeeId,
        ...(options.absenceTypeCode ? { absenceTypeCode: options.absenceTypeCode } : {}),
        status: "APPROVED",
        startDate: { gte: yearStart },
        ...(options.excludeRequestId ? { id: { not: options.excludeRequestId } } : {}),
      },
      select: { absenceTypeCode: true, startDate: true, endDate: true },
    }),
    prisma.dailyAttendanceRecord.findMany({
      where: {
        employeeId,
        absenceTypeCode: options.absenceTypeCode ?? { not: null },
        attendanceDate: { gte: yearStart },
      },
      select: { absenceTypeCode: true, attendanceDate: true },
    }),
  ]);

  const daysByType = new Map<string, Set<number>>();
  const addDay = (code: string, day: Date) => {
    if (!daysByType.has(code)) daysByType.set(code, new Set());
    daysByType.get(code)!.add(day.getTime());
  };

  if (requests.length > 0) {
    const rangeStart = new Date(Math.min(...requests.map((r) => r.startDate.getTime())));
    const rangeEnd = new Date(Math.max(...requests.map((r) => r.endDate.getTime())));
    const isScheduled = await loadScheduledDayLookup([employeeId], rangeStart, rangeEnd);
    for (const r of requests) {
      for (const day of scheduledDaysInRange(isScheduled, employeeId, r.startDate, r.endDate)) {
        addDay(r.absenceTypeCode, day);
      }
    }
  }
  for (const record of classifiedDays) {
    if (record.absenceTypeCode) addDay(record.absenceTypeCode, record.attendanceDate);
  }
  return daysByType;
}

export async function usedDaysThisYear(
  employeeId: string,
  absenceTypeCode: string,
  excludeRequestId?: string
): Promise<number> {
  const daysByType = await collectUsedDays(employeeId, { absenceTypeCode, excludeRequestId });
  return daysByType.get(absenceTypeCode)?.size ?? 0;
}

/**
 * Batched sibling of resolveAnnualQuota — every call site that needs "this
 * employee's quota for every type" (a quota panel, a self-service form) was
 * calling resolveAnnualQuota once per type in a loop, firing 2 queries per
 * type. This fires exactly 2 queries total and returns a lookup map; a
 * missing key means unlimited/not configured, same as resolveAnnualQuota's
 * `null`, so callers should read it as `quotaByType.get(code) ?? null`.
 */
export async function resolveAnnualQuotaByType(employeeId: string): Promise<Map<string, number>> {
  const [configs, overrides] = await Promise.all([
    prisma.absenceEntitlementConfig.findMany({ select: { absenceTypeCode: true, annualDays: true } }),
    prisma.absenceQuotaOverride.findMany({ where: { employeeId }, select: { absenceTypeCode: true, annualDays: true } }),
  ]);
  const quotaByType = new Map<string, number>();
  for (const c of configs) quotaByType.set(c.absenceTypeCode, c.annualDays);
  for (const o of overrides) quotaByType.set(o.absenceTypeCode, o.annualDays); // override wins
  return quotaByType;
}

/**
 * Batched sibling of usedDaysThisYear — every type at once instead of one
 * call per type. A missing key means 0 used, so callers should read it as
 * `usedByType.get(code) ?? 0`.
 */
export async function usedDaysThisYearByType(employeeId: string, excludeRequestId?: string): Promise<Map<string, number>> {
  const daysByType = await collectUsedDays(employeeId, { excludeRequestId });
  return new Map([...daysByType.entries()].map(([code, days]) => [code, days.size]));
}

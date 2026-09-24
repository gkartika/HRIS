import { prisma } from "@/lib/db";
import { companyYear } from "@/lib/company-time";
import { absenceDayCount } from "@/lib/absence";

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
 * Sum of absenceDayCount() over this employee's APPROVED requests of this
 * type since Jan 1 of the current year — same computation the Cuti-only
 * "remaining days" hint already used, generalized to any type — PLUS every
 * day HR directly classified with this type via Rekonsiliasi Absensi
 * (DailyAttendanceRecord.absenceTypeCode). Per direct request: an HR
 * override of Cuti/Izin/Sakit deducts the employee's quota immediately,
 * with no separate AbsenceRequest and no approval step — the classified day
 * itself is the only record, so it must count here or the quota would never
 * reflect it. `excludeRequestId` lets a request's own detail page compute
 * "used before this one" without double-counting itself once approved.
 */
export async function usedDaysThisYear(
  employeeId: string,
  absenceTypeCode: string,
  excludeRequestId?: string
): Promise<number> {
  const yearStart = new Date(Date.UTC(companyYear(), 0, 1));
  const [requests, classifiedDays] = await Promise.all([
    prisma.absenceRequest.findMany({
      where: {
        employeeId,
        absenceTypeCode,
        status: "APPROVED",
        startDate: { gte: yearStart },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      select: { startDate: true, endDate: true },
    }),
    prisma.dailyAttendanceRecord.count({
      where: { employeeId, absenceTypeCode, attendanceDate: { gte: yearStart } },
    }),
  ]);
  const requestedDays = requests.reduce((sum, r) => sum + absenceDayCount(r.startDate, r.endDate), 0);
  return requestedDays + classifiedDays;
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
 * Batched sibling of usedDaysThisYear — same "every type at once" reasoning
 * as resolveAnnualQuotaByType, collapsing N types x 2 queries into 2
 * queries total. A missing key means 0 used, so callers should read it as
 * `usedByType.get(code) ?? 0`.
 */
export async function usedDaysThisYearByType(employeeId: string, excludeRequestId?: string): Promise<Map<string, number>> {
  const yearStart = new Date(Date.UTC(companyYear(), 0, 1));
  const [requests, classifiedGroups] = await Promise.all([
    prisma.absenceRequest.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        startDate: { gte: yearStart },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      select: { absenceTypeCode: true, startDate: true, endDate: true },
    }),
    prisma.dailyAttendanceRecord.groupBy({
      by: ["absenceTypeCode"],
      where: { employeeId, absenceTypeCode: { not: null }, attendanceDate: { gte: yearStart } },
      _count: { _all: true },
    }),
  ]);

  const usedByType = new Map<string, number>();
  for (const r of requests) {
    usedByType.set(r.absenceTypeCode, (usedByType.get(r.absenceTypeCode) ?? 0) + absenceDayCount(r.startDate, r.endDate));
  }
  for (const g of classifiedGroups) {
    if (!g.absenceTypeCode) continue;
    usedByType.set(g.absenceTypeCode, (usedByType.get(g.absenceTypeCode) ?? 0) + g._count._all);
  }
  return usedByType;
}

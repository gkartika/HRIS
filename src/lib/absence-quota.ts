import { prisma } from "@/lib/db";
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
 * "remaining days" hint already used, generalized to any type. `excludeRequestId`
 * lets a request's own detail page compute "used before this one" without
 * double-counting itself once it's been approved.
 */
export async function usedDaysThisYear(
  employeeId: string,
  absenceTypeCode: string,
  excludeRequestId?: string
): Promise<number> {
  const requests = await prisma.absenceRequest.findMany({
    where: {
      employeeId,
      absenceTypeCode,
      status: "APPROVED",
      startDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: { startDate: true, endDate: true },
  });
  return requests.reduce((sum, r) => sum + absenceDayCount(r.startDate, r.endDate), 0);
}

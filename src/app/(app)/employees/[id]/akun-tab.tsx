import { prisma } from "@/lib/db";
import { usedDaysThisYearByType } from "@/lib/absence-quota";
import { AccountAccessPanel } from "./account-access-panel";
import { AttendanceAssignmentPanel } from "./attendance-panel";
import { AbsenceQuotaPanel } from "./absence-quota-panel";

const SECTION_DIVIDERS =
  "[&>*:not(:first-child)]:mt-6 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-slate-100 [&>*:not(:first-child)]:pt-6";

// Split out of page.tsx and wrapped in <Suspense> there: the absence quota
// table alone is 4 queries, and attendance assignment is 2 more — none of
// it needed for the default Profil tab view.
export async function AkunTabContent({
  employeeId,
  accountStatus,
  personalEmail,
  canManageAccountAccess,
  canSeeAttendance,
  canManageAttendance,
  canManageAbsenceQuota,
}: {
  employeeId: string;
  accountStatus: string | null;
  personalEmail: string | null;
  canManageAccountAccess: boolean;
  canSeeAttendance: boolean;
  canManageAttendance: boolean;
  canManageAbsenceQuota: boolean;
}) {
  async function loadAttendance() {
    if (!canSeeAttendance) return { geofences: [], current: null };
    const [geofences, current] = await Promise.all([
      canManageAttendance
        ? prisma.attendanceGeofence.findMany({ where: { activeFlag: true }, orderBy: { siteName: "asc" } })
        : Promise.resolve([]),
      prisma.attendanceAssignment.findFirst({
        where: { employeeId, effectiveTo: null },
        include: { geofence: true },
        orderBy: { effectiveFrom: "desc" },
      }),
    ]);
    return { geofences, current };
  }

  const [{ geofences, current: currentAttendanceAssignment }, absenceQuotaRows] = await Promise.all([
    loadAttendance(),
    canManageAbsenceQuota
      ? (async () => {
          const [types, entitlements, overrides, usedByType] = await Promise.all([
            prisma.absenceTypeConfig.findMany({ where: { activeFlag: true }, orderBy: { sortOrder: "asc" } }),
            prisma.absenceEntitlementConfig.findMany(),
            prisma.absenceQuotaOverride.findMany({ where: { employeeId } }),
            usedDaysThisYearByType(employeeId),
          ]);
          const defaultByCode = new Map(entitlements.map((e) => [e.absenceTypeCode, e.annualDays]));
          const overrideByCode = new Map(overrides.map((o) => [o.absenceTypeCode, o.annualDays]));
          return types.map((tp) => ({
            code: tp.code,
            label: tp.label,
            defaultAnnualDays: defaultByCode.has(tp.code) ? defaultByCode.get(tp.code)! : null,
            overrideAnnualDays: overrideByCode.get(tp.code) ?? null,
            usedDaysThisYear: usedByType.get(tp.code) ?? 0,
          }));
        })()
      : Promise.resolve([]),
  ]);

  return (
    <div className={SECTION_DIVIDERS}>
      {canManageAccountAccess && (
        <AccountAccessPanel employeeId={employeeId} accountStatus={accountStatus} personalEmail={personalEmail} />
      )}
      {canSeeAttendance && (
        <AttendanceAssignmentPanel
          employeeId={employeeId}
          canManage={canManageAttendance}
          current={
            currentAttendanceAssignment
              ? {
                  method: currentAttendanceAssignment.method,
                  geofenceName: currentAttendanceAssignment.geofence?.siteName ?? null,
                  fingerprintDeviceUserId: currentAttendanceAssignment.fingerprintDeviceUserId,
                  effectiveFrom: currentAttendanceAssignment.effectiveFrom.toISOString().slice(0, 10),
                }
              : null
          }
          geofences={geofences}
        />
      )}
      {canManageAbsenceQuota && <AbsenceQuotaPanel employeeId={employeeId} rows={absenceQuotaRows} />}
    </div>
  );
}

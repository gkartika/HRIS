import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, canExportAttendanceData } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { reconcileDueDailyAttendance } from "@/lib/attendance-reconciliation";
import { computeAttendanceRecordsForDate } from "@/lib/attendance-records";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import type { Prisma } from "@/generated/prisma/client";

const SHIFT_BADGE_TONE: Record<string, string> = {
  SHIFT_1: "bg-slate-100 text-slate-600",
  SHIFT_2: "bg-sky-50 text-sky-700",
  SHIFT_3: "bg-indigo-50 text-indigo-700",
  NON_SHIFT: "bg-slate-100 text-slate-500",
};

const ABSENCE_BADGE_TONE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  PENDING_HR_ADMIN: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
};

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default async function AttendanceRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    orgUnitId?: string;
    jobLevel?: string;
    exceptionsOnly?: string;
    method?: string;
  }>;
}) {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);

  if (!isHrAdminUser && level3DepartmentIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  await reconcileDueDailyAttendance();

  const { date, orgUnitId, jobLevel, exceptionsOnly, method } = await searchParams;
  const selectedDate = date ? new Date(date) : new Date();
  const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const dateIso = isoOf(dayStart);

  const positionFilter: Prisma.PositionWhereInput = {};
  if (!isHrAdminUser) {
    positionFilter.orgUnit = {
      OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }],
    };
  }
  if (orgUnitId) positionFilter.orgUnitId = orgUnitId;
  if (jobLevel) positionFilter.jobLevel = jobLevel;

  const [employees, orgUnits, jobLevels] = await Promise.all([
    prisma.employee.findMany({
      where: {
        activeFlag: true,
        ...(Object.keys(positionFilter).length > 0 ? { currentPosition: positionFilter } : {}),
      },
      include: { currentPosition: { include: { orgUnit: true } } },
      orderBy: { fullLegalName: "asc" },
    }),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ distinct: ["jobLevel"], select: { jobLevel: true }, orderBy: { jobLevel: "asc" } }),
  ]);

  const employeeIds = employees.map((e) => e.id);
  const allRows = await computeAttendanceRecordsForDate(employeeIds, dayStart);
  const rows = allRows
    .filter((row) => !exceptionsOnly || row.exceptions.length > 0 || !row.hasAssignment)
    .filter((row) => {
      if (!method) return true;
      if (method === "NONE") return !row.hasAssignment;
      return row.method === method;
    });

  const hasFilters = !!(orgUnitId || jobLevel || exceptionsOnly || method);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("attendanceRecords.navLabel")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("attendanceRecords.subtitle")}</p>
        </div>
        {canExportAttendanceData(session) && (
          <a
            href={`/api/attendance/export?${new URLSearchParams({ date: dateIso, ...(method ? { method } : {}) }).toString()}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("attendanceRecords.exportButton")}
          </a>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("attendanceRecords.dateLabel")}</label>
          <input
            type="date"
            name="date"
            defaultValue={dateIso}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.department")}</label>
          <select name="orgUnitId" defaultValue={orgUnitId ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {orgUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Level</label>
          <select name="jobLevel" defaultValue={jobLevel ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {jobLevels.map((p) => (
              <option key={p.jobLevel} value={p.jobLevel}>
                {p.jobLevel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("attendanceRecords.methodFilterLabel")}</label>
          <select name="method" defaultValue={method ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            <option value="MOBILE">{t("attendanceMethod.MOBILE")}</option>
            <option value="FINGERPRINT">{t("attendanceMethod.FINGERPRINT")}</option>
            <option value="NONE">{t("attendanceRecords.methodFilterNoneOption")}</option>
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="exceptionsOnly" value="1" defaultChecked={exceptionsOnly === "1"} />
          {t("attendanceRecords.exceptionsOnlyLabel")}
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href={`/attendance/records?date=${dateIso}`} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      <p className="mb-2 text-xs text-slate-400">{t("attendanceRecords.showingCount", { count: rows.length })}</p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("employee.employeeNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
              <th className="px-4 py-3 font-medium">{t("employee.department")}</th>
              <th className="px-4 py-3 font-medium">{t("attendanceRecords.shiftColumnLabel")}</th>
              <th className="px-4 py-3 font-medium">Check-in</th>
              <th className="px-4 py-3 font-medium">Check-out</th>
              <th className="px-4 py-3 font-medium">Pengecualian</th>
              <th className="px-4 py-3 font-medium">{t("attendanceRecords.absenceColumnLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{row.employeeNumber}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3 text-slate-600">{row.departmentName}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-medium ${SHIFT_BADGE_TONE[row.shiftType]}`}>
                    {t(`shiftAssignmentType.${row.shiftType}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatTime(row.checkInAt)}</td>
                <td className="px-4 py-3 text-slate-600">{formatTime(row.checkOutAt)}</td>
                <td className="px-4 py-3">
                  {!row.hasAssignment ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                      {t("attendanceRecords.noAssignmentBadge")}
                    </span>
                  ) : row.exceptions.length === 0 ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      {t("attendanceRecords.noExceptions")}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {row.exceptions.map((ex) => (
                        <span key={ex} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                          {t(`attendanceException.${ex}`)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.activeAbsence ? (
                    <Link
                      href={`/absences/${row.activeAbsence.id}`}
                      className={`inline-block rounded-md px-2 py-1 text-xs font-medium hover:underline ${ABSENCE_BADGE_TONE[row.activeAbsence.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {t(`absenceType.${row.activeAbsence.absenceType}`)} — {t(`absenceStatus.${row.activeAbsence.status}`)}
                    </Link>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-slate-400">{t("common.noFilteredResults")}</p>}
      </div>
    </div>
  );
}

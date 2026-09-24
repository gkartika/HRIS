import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ShiftScheduler, type SchedulerEmployee, type SchedulerShift } from "./shift-scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekLabel(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + 6 * DAY_MS);
  const startPart =
    weekStart.getUTCMonth() === end.getUTCMonth()
      ? String(weekStart.getUTCDate())
      : `${weekStart.getUTCDate()} ${MONTHS[weekStart.getUTCMonth()]}`;
  return `${startPart} – ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

function weekTag(weekStart: Date, currentWeekStart: Date): string {
  const diffWeeks = Math.round((weekStart.getTime() - currentWeekStart.getTime()) / (7 * DAY_MS));
  if (diffWeeks === 0) return "Minggu ini";
  if (diffWeeks === 1) return "Minggu depan";
  if (diffWeeks === -1) return "Minggu lalu";
  return diffWeeks > 0 ? "Mendatang" : "Sudah lewat";
}

// HR Admin sees every active employee; a Level-3 (3A/3B) holder sees every
// employee in the department(s) they hold that authority in — at any depth
// (Section/Group/Team included). Anyone else gets the access-denied line and
// no menu entry (see layout.tsx). Default is Shift 1 for everyone; only the
// exceptions are stored, so this screen is about moving people OFF the
// default.
export default async function ShiftAssignmentsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);

  if (!isHrAdminUser && level3DepartmentIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { week } = await searchParams;
  const parsedWeek = week && !Number.isNaN(new Date(week).getTime()) ? new Date(week) : new Date();
  const weekStartDate = normalizeWeekStart(parsedWeek);
  const prevWeekStartDate = new Date(weekStartDate.getTime() - 7 * DAY_MS);
  const nextWeekStartDate = new Date(weekStartDate.getTime() + 7 * DAY_MS);
  const currentWeekStart = normalizeWeekStart(new Date());

  const [units, allEmployees] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.employee.findMany({
      where: { activeFlag: true },
      select: {
        id: true,
        fullLegalName: true,
        employeeNumber: true,
        currentPosition: { select: { orgUnitId: true, job: { select: { jobTitle: true } } } },
      },
      orderBy: { fullLegalName: "asc" },
    }),
  ]);
  const tree = buildOrgUnitTree(units);

  const employees: SchedulerEmployee[] = allEmployees
    .map((e) => {
      const orgUnitId = e.currentPosition?.orgUnitId;
      const department = orgUnitId ? tree.departmentOf(orgUnitId) : null;
      const group = orgUnitId ? tree.groupOf(orgUnitId) : null;
      return {
        id: e.id,
        name: e.fullLegalName,
        employeeNumber: e.employeeNumber,
        jobTitle: e.currentPosition?.job.jobTitle ?? "—",
        departmentId: department?.id ?? null,
        departmentName: department?.unitName ?? "—",
        groupId: group?.id ?? null,
        groupName: group?.unitName ?? null,
      };
    })
    .filter((e) => isHrAdminUser || (e.departmentId !== null && level3DepartmentIds.includes(e.departmentId)));

  const employeeIds = employees.map((e) => e.id);
  const [thisWeek, prevWeek] = await Promise.all([
    prisma.shiftAssignment.findMany({ where: { weekStartDate, employeeId: { in: employeeIds } } }),
    prisma.shiftAssignment.findMany({ where: { weekStartDate: prevWeekStartDate, employeeId: { in: employeeIds } } }),
  ]);
  // A stored SHIFT_1 row (from the old screen) is the same as no row.
  const toMap = (rows: typeof thisWeek) =>
    Object.fromEntries(rows.filter((r) => r.shiftType !== "SHIFT_1").map((r) => [r.employeeId, r.shiftType as SchedulerShift]));

  // "Notify HR Admin" per direct user request — this app has no outbound
  // email/push channel, so the honest equivalent is a visible feed of every
  // change the moment HR Admin opens this page, sourced from the same
  // AuditLog every other change in the app already writes to.
  const recentChanges = isHrAdminUser
    ? await prisma.auditLog.findMany({
        where: { datasetName: "ShiftAssignment" },
        orderBy: { eventAt: "desc" },
        take: 15,
        include: { actorAccount: { select: { usernameOrEmail: true } } },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("shiftAssignment.navLabel")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Semua karyawan otomatis <b>Shift 1</b>. Centang karyawan yang pindah, lalu pilih shift tujuannya — bisa banyak
        sekaligus.
      </p>

      <ShiftScheduler
        key={isoOf(weekStartDate)}
        employees={employees}
        saved={toMap(thisWeek)}
        prevSaved={toMap(prevWeek)}
        weekStartIso={isoOf(weekStartDate)}
        weekLabel={weekLabel(weekStartDate)}
        weekTag={weekTag(weekStartDate, currentWeekStart)}
        prevWeekIso={isoOf(prevWeekStartDate)}
        nextWeekIso={isoOf(nextWeekStartDate)}
      />

      {isHrAdminUser && recentChanges.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">{t("shiftAssignment.recentChangesTitle")}</p>
          <ul className="mt-2 space-y-1">
            {recentChanges.map((log) => (
              <li key={log.id} className="text-xs text-slate-600">
                <span className="text-slate-400">
                  {new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(log.eventAt)}
                </span>{" "}
                — {log.reason} ({log.actorAccount?.usernameOrEmail ?? "—"})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

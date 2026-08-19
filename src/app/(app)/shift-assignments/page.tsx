import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ShiftBulkForm, type ShiftEmployeeRow } from "./shift-bulk-form";
import type { Prisma } from "@/generated/prisma/client";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

const SHIFT_TYPES: ShiftAssignmentType[] = ["SHIFT_1", "SHIFT_2", "SHIFT_3", "NON_SHIFT"];

const DAY_MS = 24 * 60 * 60 * 1000;

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// New module, per direct user request: HR Admin sees every active
// employee; a Level-3 (3A/3B) holder sees only employees in the
// department(s) they hold that authority in — same submit eligibility
// already used for Perubahan Posisi (src/lib/level3-scope.ts).
export default async function ShiftAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; orgUnitId?: string; jobLevel?: string; shiftType?: string }>;
}) {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);

  if (!isHrAdminUser && level3DepartmentIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  // Per direct user request: every week stays a real, individually visible
  // and editable record (already true at the data layer — one row per
  // employee per week, upserted, never overwritten-and-lost) — this page no
  // longer hardcodes "the current week," it just defaults to it.
  const { week, orgUnitId, jobLevel, shiftType } = await searchParams;
  const weekStartDate = normalizeWeekStart(week ? new Date(week) : new Date());
  const weekStartDateIso = isoOf(weekStartDate);
  const prevWeekIso = isoOf(new Date(weekStartDate.getTime() - 7 * DAY_MS));
  const nextWeekIso = isoOf(new Date(weekStartDate.getTime() + 7 * DAY_MS));

  const positionFilter: Prisma.PositionWhereInput = {};
  if (!isHrAdminUser) {
    positionFilter.orgUnit = {
      OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }],
    };
  }
  if (orgUnitId) positionFilter.orgUnitId = orgUnitId;
  if (jobLevel) positionFilter.jobLevel = jobLevel;

  const where: Prisma.EmployeeWhereInput = {
    activeFlag: true,
    ...(Object.keys(positionFilter).length > 0 ? { currentPosition: positionFilter } : {}),
  };

  const [employees, orgUnits, jobLevels] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { currentPosition: { include: { orgUnit: true } } },
      orderBy: { fullLegalName: "asc" },
    }),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.position.findMany({
      distinct: ["jobLevel"],
      select: { jobLevel: true },
      orderBy: { jobLevel: "asc" },
    }),
  ]);

  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: { weekStartDate, employeeId: { in: employees.map((e) => e.id) } },
  });
  const shiftByEmployeeId = new Map(shiftAssignments.map((s) => [s.employeeId, s]));

  // Filtering by Shift happens after the join (not in the Employee `where`
  // above) since "no row this week" itself counts as Shift 1 — a DB-level
  // filter on ShiftAssignment.shiftType alone would silently drop everyone
  // still sitting on the default.
  const rows: ShiftEmployeeRow[] = employees
    .map((e) => {
      const current = shiftByEmployeeId.get(e.id);
      return {
        id: e.id,
        name: e.fullLegalName,
        employeeNumber: e.employeeNumber,
        departmentName: e.currentPosition?.orgUnit.unitName ?? "—",
        jobLevel: e.currentPosition?.jobLevel ?? null,
        currentShiftType: current?.shiftType ?? null,
        isHrOverride: current?.isHrOverride ?? false,
      };
    })
    .filter((row) => !shiftType || (row.currentShiftType ?? "SHIFT_1") === shiftType);

  // "Notify HR Admin" per direct user request — this app has no outbound
  // email/push channel, so the honest equivalent is a visible feed of every
  // create/edit the moment HR Admin opens this page, sourced from the same
  // AuditLog every other change in the app already writes to.
  const recentChanges = isHrAdminUser
    ? await prisma.auditLog.findMany({
        where: { datasetName: "ShiftAssignment" },
        orderBy: { eventAt: "desc" },
        take: 15,
        include: { actorAccount: { select: { usernameOrEmail: true } } },
      })
    : [];

  const hasFilters = !!(orgUnitId || jobLevel || shiftType);
  const carryParams = {
    ...(orgUnitId ? { orgUnitId } : {}),
    ...(jobLevel ? { jobLevel } : {}),
    ...(shiftType ? { shiftType } : {}),
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("shiftAssignment.navLabel")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("shiftAssignment.listSubtitle")} — {t("shiftAssignment.weekOf")}{" "}
            {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(weekStartDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/shift-assignments?${new URLSearchParams({ ...carryParams, week: prevWeekIso }).toString()}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("shiftAssignment.previousWeek")}
          </Link>
          <Link
            href={`/shift-assignments?${new URLSearchParams({ ...carryParams, week: nextWeekIso }).toString()}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("shiftAssignment.nextWeek")}
          </Link>
        </div>
      </div>

      {isHrAdminUser && recentChanges.length > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">{t("shiftAssignment.recentChangesTitle")}</p>
          <ul className="mt-2 space-y-1">
            {recentChanges.map((log) => (
              <li key={log.id} className="text-xs text-slate-600">
                <span className="text-slate-400">
                  {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(log.eventAt)}
                </span>{" "}
                — {log.reason} ({log.actorAccount?.usernameOrEmail ?? "—"})
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="week" value={weekStartDateIso} />
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.department")}</label>
          <select
            name="orgUnitId"
            defaultValue={orgUnitId ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
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
          <select
            name="jobLevel"
            defaultValue={jobLevel ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {jobLevels.map((p) => (
              <option key={p.jobLevel} value={p.jobLevel}>
                {p.jobLevel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("shiftAssignment.currentShift")}</label>
          <select
            name="shiftType"
            defaultValue={shiftType ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {SHIFT_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`shiftAssignmentType.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link
              href={`/shift-assignments?week=${weekStartDateIso}`}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      <p className="mb-2 text-xs text-slate-400">
        {t("shiftAssignment.showingCount", { count: rows.length })}
      </p>
      <ShiftBulkForm employees={rows} weekStartDateIso={weekStartDateIso} />
    </div>
  );
}

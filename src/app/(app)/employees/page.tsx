import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canListEmployees, canCreateEmployee, isHrAdmin, projectEmployee } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { isEmployeeProfileIncomplete } from "@/lib/employee-completeness";
import { deriveEmployeeLifecycleStatus } from "@/lib/employee-lifecycle";
import type { Prisma } from "@/generated/prisma/client";

const LIFECYCLE_BADGE_TONE: Record<string, string> = {
  AKAN_MASUK: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  OUT: "bg-rose-50 text-rose-700",
};

const EMPLOYMENT_STATUSES = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"] as const;
const PAGE_SIZE = 25;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    orgUnitId?: string;
    jobLevel?: string;
    employmentStatus?: string;
    activeFlag?: string;
    page?: string;
  }>;
}) {
  const session = await requireSession();
  if (!canListEmployees(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { q, orgUnitId, jobLevel, employmentStatus, activeFlag, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const where: Prisma.EmployeeWhereInput = {};
  if (q?.trim()) {
    // Also matches the employee's current job title — with 180+ people,
    // typing "Operator CNC" is often faster than hunting through a long
    // Department/Level combination.
    const query = q.trim();
    where.OR = [
      { employeeNumber: { contains: query, mode: "insensitive" } },
      { fullLegalName: { contains: query, mode: "insensitive" } },
      { currentPosition: { job: { jobTitle: { contains: query, mode: "insensitive" } } } },
    ];
  }
  const positionFilter: Prisma.PositionWhereInput = {};
  if (orgUnitId) positionFilter.orgUnitId = orgUnitId;
  if (jobLevel) positionFilter.jobLevel = jobLevel;
  if (Object.keys(positionFilter).length > 0) where.currentPosition = positionFilter;
  if (employmentStatus) {
    where.employmentStatus = employmentStatus as (typeof EMPLOYMENT_STATUSES)[number];
  }
  if (activeFlag === "true" || activeFlag === "false") {
    where.activeFlag = activeFlag === "true";
  }

  const [employees, filteredCount, orgUnits, jobLevels, totalCount] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { employeeNumber: "asc" },
      include: { currentPosition: { include: { job: true, orgUnit: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.employee.count({ where }),
    // DEPARTMENT-only — feeds the "Departemen" filter, which must not list
    // Section/Group/Team-tier units (ORG-01 depth work).
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ distinct: ["jobLevel"], select: { jobLevel: true }, orderBy: { jobLevel: "asc" } }),
    prisma.employee.count(),
    // Doesn't depend on the reads above and they don't depend on it —
    // run it alongside them instead of as an extra sequential round trip.
    logAudit({
      actorAccountId: session.user.id,
      action: "VIEW",
      datasetName: "Employee",
      reason: "Viewed employee list",
    }),
  ]);

  const rows = employees.map((e) => projectEmployee(e, session));
  const hasFilters = !!(q || orgUnitId || jobLevel || employmentStatus || activeFlag);
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const carryParams = {
    ...(q ? { q } : {}),
    ...(orgUnitId ? { orgUnitId } : {}),
    ...(jobLevel ? { jobLevel } : {}),
    ...(employmentStatus ? { employmentStatus } : {}),
    ...(activeFlag ? { activeFlag } : {}),
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("employee.listTitle")}</h1>
          <p className="mt-1 text-xs text-slate-400">{t("common.filteredCount", { shown: filteredCount, total: totalCount })}</p>
        </div>
        {canCreateEmployee(session) && (
          <Link
            href="/employees/new"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <UserPlus size={14} />
            {t("employee.addEmployee")}
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nomor, nama, atau jabatan"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
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
          <label className="mb-1 block text-xs text-slate-500">{t("employee.employmentStatus")}</label>
          <select
            name="employmentStatus"
            defaultValue={employmentStatus ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`employmentStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status Aktif</label>
          <select
            name="activeFlag"
            defaultValue={activeFlag ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            <option value="true">{t("common.active")}</option>
            <option value="false">{t("common.inactive")}</option>
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
            <Link href="/employees" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {employees.length === 0 ? (
        <p className="text-sm text-slate-400">
          {hasFilters ? t("common.noFilteredResults") : t("employee.emptyState")}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("employee.employeeNumber")}</th>
                  <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                  <th className="px-4 py-3 font-medium">{t("employee.currentPosition")}</th>
                  <th className="px-4 py-3 font-medium">{t("employee.employmentStatus")}</th>
                  <th className="px-4 py-3 font-medium">{t("employee.lifecycleStatus")}</th>
                  {isHrAdmin(session) && <th className="px-4 py-3 font-medium">Kelengkapan Data</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, idx) => {
                  const row = rows[idx];
                  return (
                    <tr key={employee.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <Link
                          href={`/employees/${employee.id}`}
                          className="font-mono text-xs text-indigo-600 hover:underline"
                        >
                          {row.employeeNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.fullLegalName}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {employee.currentPosition
                          ? `${employee.currentPosition.jobLevel} ${employee.currentPosition.job.jobTitle} — ${employee.currentPosition.orgUnit.unitName}`
                          : t("employee.noPosition")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.employmentStatus ? t(`employmentStatus.${row.employmentStatus}`) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const lifecycleStatus = deriveEmployeeLifecycleStatus(employee.activeFlag, employee.hireDate);
                          return (
                            <span className={`rounded-md px-2 py-1 text-xs font-medium ${LIFECYCLE_BADGE_TONE[lifecycleStatus]}`}>
                              {t(`employeeLifecycleStatus.${lifecycleStatus}`)}
                            </span>
                          );
                        })()}
                      </td>
                      {isHrAdmin(session) && (
                        <td className="px-4 py-3">
                          {isEmployeeProfileIncomplete(employee) ? (
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                              Belum Lengkap
                            </span>
                          ) : (
                            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              Lengkap
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-400">{t("common.pageOf", { page, totalPages })}</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/employees?${new URLSearchParams({ ...carryParams, page: String(page - 1) }).toString()}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {t("common.previousPage")}
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/employees?${new URLSearchParams({ ...carryParams, page: String(page + 1) }).toString()}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {t("common.nextPage")}
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

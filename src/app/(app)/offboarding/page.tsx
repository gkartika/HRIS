import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isOverdue } from "@/lib/work-calendar";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import type { Prisma, OffboardingCaseStatus, OffboardingReason } from "@/generated/prisma/client";

const REASONS: OffboardingReason[] = ["RESIGNATION", "CONTRACT_NON_RENEWAL"];
const STATUSES: OffboardingCaseStatus[] = [
  "PENDING_DEPT_HEAD",
  "PENDING_HR_MANAGER",
  "PENDING_CLEARANCE",
  "COMPLETED",
  "CANCELLED",
];

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(date));
}

// LIF-06/DSH-14: HR Admin and the active HR Manager see every case
// (operational/oversight surfaces); everyone else sees only cases about
// themselves or that they personally reported (DM-25-style self-scoping,
// same as Recruitment/Movement's own list visibility for non-privileged
// viewers) — no dedicated ACC-xx entry exists for this scope.
export default async function OffboardingListPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; status?: string; orgUnitId?: string; reportedByAccountId?: string }>;
}) {
  const session = await requireSession();
  const { reason, status, orgUnitId, reportedByAccountId } = await searchParams;

  const isHrAdminUser = isHrAdmin(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const seesAll = isHrAdminUser || hrManagerPositions.length > 0;

  const conditions: Prisma.OffboardingCaseWhereInput[] = [];
  if (!seesAll) {
    conditions.push({
      OR: [{ employeeId: session.user.employeeId ?? "__none__" }, { reportedByAccountId: session.user.id }],
    });
  }
  if (reason) conditions.push({ reason: reason as OffboardingReason });
  if (status) conditions.push({ status: status as OffboardingCaseStatus });
  if (orgUnitId) conditions.push({ employee: { currentPosition: { orgUnitId } } });
  if (reportedByAccountId) conditions.push({ reportedByAccountId });
  const where: Prisma.OffboardingCaseWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [cases, orgUnits, reporters] = await Promise.all([
    prisma.offboardingCase.findMany({
      where,
      include: {
        employee: { include: { currentPosition: { include: { orgUnit: true } } } },
        reportedByAccount: true,
      },
      orderBy: { reportedAt: "desc" },
    }),
    isHrAdminUser || hrManagerPositions.length > 0
      ? prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } })
      : Promise.resolve([]),
    isHrAdminUser
      ? prisma.account.findMany({
          where: { offboardingCasesReportedBy: { some: {} } },
          orderBy: { usernameOrEmail: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const hasFilters = !!(reason || status || orgUnitId || reportedByAccountId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("offboarding.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("offboarding.listSubtitle")}</p>
        </div>
        <Link href="/offboarding/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("offboarding.reportButton")}
        </Link>
      </div>

      <form className="mt-4 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("offboarding.reason")}</label>
          <select name="reason" defaultValue={reason ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`offboardingReason.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`offboardingCaseStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        {(isHrAdminUser || hrManagerPositions.length > 0) && (
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
        )}
        {isHrAdminUser && reporters.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("offboarding.owner")}</label>
            <select name="reportedByAccountId" defaultValue={reportedByAccountId ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">{t("common.allOption")}</option>
              {reporters.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.usernameOrEmail}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/offboarding" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {cases.length === 0 ? (
        <p className="text-sm text-slate-400">{hasFilters ? t("common.noFilteredResults") : t("offboarding.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("offboarding.caseNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("offboarding.reason")}</th>
                <th className="px-4 py-3 font-medium">{t("offboarding.lastWorkingDay")}</th>
                <th className="px-4 py-3 font-medium">{t("offboarding.clearanceDueDate")}</th>
                <th className="px-4 py-3 font-medium">{t("offboarding.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const overdue = c.status === "PENDING_CLEARANCE" && isOverdue(c.clearanceDueDate);
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/offboarding/${c.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.employee.fullLegalName}
                      {c.employee.currentPosition && (
                        <span className="block text-xs text-slate-400">{c.employee.currentPosition.orgUnit.unitName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t(`offboardingReason.${c.reason}`)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.lastWorkingDay)}</td>
                    <td className="px-4 py-3">
                      <span className={overdue ? "font-medium text-rose-600" : "text-slate-600"}>
                        {formatDate(c.clearanceDueDate)}
                        {overdue && ` (${t("offboarding.overdueBadge")})`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.reportedByAccount?.usernameOrEmail ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {t(`offboardingCaseStatus.${c.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

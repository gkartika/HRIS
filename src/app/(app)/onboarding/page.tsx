import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canViewOnboarding } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeOnboardingStatus } from "@/lib/onboarding";
import type { Prisma, OnboardingOverallStatus } from "@/generated/prisma/client";

const ONBOARDING_STATUSES: OnboardingOverallStatus[] = ["NOT_STARTED", "IN_PROGRESS", "OVERDUE", "COMPLETE"];

export default async function OnboardingListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; orgUnitId?: string }>;
}) {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canViewOnboarding(session, hrManagerPositions.map((p) => p.positionId))) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { status, orgUnitId } = await searchParams;

  const where: Prisma.OnboardingCaseWhereInput = {};
  if (orgUnitId) {
    where.employee = { currentPosition: { orgUnitId } };
  }

  const [cases, orgUnits] = await Promise.all([
    prisma.onboardingCase.findMany({
      where,
      include: { employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } } },
      orderBy: { plannedStartDate: "desc" },
    }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
  ]);

  const now = new Date();
  const rows = cases
    .map((c) => ({
      case: c,
      overallStatus: computeOnboardingStatus(
        {
          contractComplete: c.contractComplete,
          mandatoryMaterialComplete: c.mandatoryMaterialComplete,
          assetsComplete: c.assetsComplete,
          plannedStartDate: c.plannedStartDate,
          mandatoryMaterialDueDate: c.mandatoryMaterialDueDate,
        },
        now
      ),
    }))
    .filter((r) => !status || r.overallStatus === status);

  const hasFilters = !!(status || orgUnitId);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("onboarding.listTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("onboarding.listSubtitle")}</p>

      <form className="mt-4 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {ONBOARDING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`onboardingStatus.${s}`)}
              </option>
            ))}
          </select>
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
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/onboarding" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">
          {hasFilters ? t("common.noFilteredResults") : t("onboarding.emptyState")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("onboarding.caseNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.currentPosition")}</th>
                <th className="px-4 py-3 font-medium">{t("onboarding.plannedStartDate")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ case: c, overallStatus }) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/onboarding/${c.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.employee.preferredName ?? c.employee.fullLegalName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.employee.currentPosition
                      ? `${c.employee.currentPosition.job.jobTitle} — ${c.employee.currentPosition.orgUnit.unitName}`
                      : t("employee.noPosition")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(c.plannedStartDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        overallStatus === "COMPLETE"
                          ? "bg-emerald-50 text-emerald-700"
                          : overallStatus === "OVERDUE"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {t(`onboardingStatus.${overallStatus}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

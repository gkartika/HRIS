import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { triggerDueRenewalCases } from "./actions";
import type { Prisma, ContractRenewalCaseStatus } from "@/generated/prisma/client";

const STATUSES: ContractRenewalCaseStatus[] = [
  "TRIGGERED",
  "EVALUATION_SENT",
  "PENDING_HR_MANAGER",
  "RETURNED",
  "REJECTED",
  "APPROVED",
  "CANCELLED",
];

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(date));
}

export default async function ContractRenewalListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status } = await searchParams;

  // LIF-08: idempotent D-30 scan — this app has no cron/scheduler, so the
  // list page's own load is the trigger point (same "derive/act on read"
  // pattern as computeExpiryUrgency).
  await triggerDueRenewalCases();

  const isHrAdminUser = isHrAdmin(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isHrManagerNow = hrManagerPositions.length > 0;
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);

  const where: Prisma.ContractRenewalCaseWhereInput =
    isHrAdminUser || isHrManagerNow
      ? {}
      : {
          OR: [
            { p1EmployeeId: session.user.employeeId ?? "__none__" },
            { p2EmployeeId: session.user.employeeId ?? "__none__" },
            { deptHeadEmployeeId: session.user.employeeId ?? "__none__" },
            deptHeadDepartmentIds.length > 0
              ? {
                  snapshotPosition: {
                    orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
                  },
                }
              : { id: "__none__" },
          ],
        };
  if (status) where.status = status as ContractRenewalCaseStatus;

  const cases = await prisma.contractRenewalCase.findMany({
    where,
    include: { employee: true, currentContract: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("contractRenewal.listTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("contractRenewal.listSubtitle")}</p>

      <form className="mt-4 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("contractRenewal.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`contractRenewalCaseStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {status && (
            <Link href="/contract-renewals" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {cases.length === 0 ? (
        <p className="text-sm text-slate-400">{status ? t("common.noFilteredResults") : t("contractRenewal.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("contractRenewal.caseNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("contract.contractNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("contractRenewal.triggerDate")}</th>
                <th className="px-4 py-3 font-medium">{t("contractRenewal.status")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/contract-renewals/${c.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.employee.preferredName ?? c.employee.fullLegalName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.currentContract.contractNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.triggerDate)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {t(`contractRenewalCaseStatus.${c.status}`)}
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

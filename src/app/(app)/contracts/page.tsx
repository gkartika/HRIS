import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeExpiryUrgency } from "@/lib/contract";
import { triggerDueRenewalCases } from "./renewal-actions";
import type { Prisma, ContractStatus } from "@/generated/prisma/client";

const CONTRACT_STATUSES: ContractStatus[] = [
  "DRAFT",
  "RELEASED",
  "SIGNED",
  "ACTIVE",
  "REVIEW_REQUESTED",
  "RECOMMENDATION_SUBMITTED",
  "APPROVED_FOR_RENEWAL",
  "NOT_RENEWED",
  "ENDED",
];

export default async function ContractListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; orgUnitId?: string }>;
}) {
  const session = await requireSession();
  const { status, orgUnitId } = await searchParams;

  // LIF-08: idempotent D-30 scan — Contract and its automated renewal case
  // are one module, so this page's own load is the trigger point (same
  // "derive/act on read" pattern as computeExpiryUrgency below).
  await triggerDueRenewalCases();

  const where: Prisma.ContractWhereInput = isHrAdmin(session)
    ? {}
    : { employeeId: session.user.employeeId ?? "__none__" };
  if (status) where.status = status as ContractStatus;
  if (orgUnitId) where.employee = { currentPosition: { orgUnitId } };

  const [contracts, orgUnits] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
        renewalCaseAsCurrentContract: { select: { caseNumber: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // DEPARTMENT-only — feeds the "Departemen" filter, which must not list
    // Section/Group/Team-tier units (ORG-01 depth work).
    isHrAdmin(session)
      ? prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } })
      : Promise.resolve([]),
  ]);

  const hasFilters = !!(status || orgUnitId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("contract.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("contract.listSubtitle")}</p>
        </div>
        {isHrAdmin(session) && (
          <Link
            href="/contracts/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("contract.newContract")}
          </Link>
        )}
      </div>

      <form className="mt-4 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`contractStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        {isHrAdmin(session) && (
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
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/contracts" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {contracts.length === 0 ? (
        <p className="text-sm text-slate-400">
          {hasFilters ? t("common.noFilteredResults") : t("contract.emptyState")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("contract.contractNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("contract.contractType")}</th>
                <th className="px-4 py-3 font-medium">{t("contract.endDate")}</th>
                <th className="px-4 py-3 font-medium">{t("contract.expiryUrgency")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
                <th className="px-4 py-3 font-medium">{t("contractRenewal.caseNumber")}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const urgency = computeExpiryUrgency(c.status, c.endDate);
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/contracts/${c.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        {c.contractNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.employee.fullLegalName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t(`employmentStatus.${c.contractType}`)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.endDate
                        ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(c.endDate)
                        : t("contract.indefinite")}
                    </td>
                    <td className="px-4 py-3">
                      {urgency !== "NONE" && (
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            urgency === "EXPIRED" || urgency === "DUE_7"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {t(`expiryUrgency.${urgency}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {t(`contractStatus.${c.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.renewalCaseAsCurrentContract && (
                        <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs font-medium text-indigo-700">
                          {c.renewalCaseAsCurrentContract.caseNumber} — {t(`contractRenewalCaseStatus.${c.renewalCaseAsCurrentContract.status}`)}
                        </span>
                      )}
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

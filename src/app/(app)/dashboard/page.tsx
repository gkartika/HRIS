import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin, isGaAdmin, canListEmployees } from "@/lib/permissions";
import { computeExpiryUrgency, type ExpiryUrgency } from "@/lib/contract";
import { t } from "@/lib/i18n/id";
import { TriggerEvaluationButton } from "./trigger-evaluation-button";

interface ExpiringContractRow {
  id: string;
  contractNumber: string;
  employeeName: string;
  orgUnitId: string | null;
  orgUnitName: string;
  endDate: Date;
  urgency: ExpiryUrgency;
  hasRenewalCase: boolean;
}

type SortKey = "endDate" | "employeeName" | "urgency";

const URGENCY_RANK: Record<ExpiryUrgency, number> = {
  EXPIRED: 0,
  DUE_7: 1,
  DUE_30: 2,
  DUE_60: 3,
  DUE_90: 4,
  NONE: 5,
};

function sortLink(
  baseParams: { orgUnitId?: string; urgency?: string },
  sortBy: SortKey,
  currentSortBy: SortKey,
  currentSortDir: "asc" | "desc"
): string {
  const nextDir = currentSortBy === sortBy && currentSortDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (baseParams.orgUnitId) params.set("orgUnitId", baseParams.orgUnitId);
  if (baseParams.urgency) params.set("urgency", baseParams.urgency);
  params.set("sortBy", sortBy);
  params.set("sortDir", nextDir);
  return `/dashboard?${params.toString()}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ orgUnitId?: string; urgency?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await requireSession();
  const roleLabels = session.user.roles.map((r) => t(`roles.${r}`)).join(", ");
  const { orgUnitId, urgency, sortBy: sortByParam, sortDir: sortDirParam } = await searchParams;
  const sortBy: SortKey = sortByParam === "employeeName" || sortByParam === "urgency" ? sortByParam : "endDate";
  const sortDir: "asc" | "desc" = sortDirParam === "desc" ? "desc" : "asc";

  const cards: { label: string; value: string | number }[] = [];

  if (canListEmployees(session)) {
    const employeeCount = await prisma.employee.count({ where: { activeFlag: true } });
    cards.push({ label: "Total Karyawan Aktif", value: employeeCount });
  }
  let expiringContracts: ExpiringContractRow[] = [];
  let orgUnits: { id: string; unitName: string }[] = [];
  if (isHrAdmin(session)) {
    const [vacantPositions, importBatches, auditEvents] = await Promise.all([
      prisma.position.count({ where: { positionStatus: "VACANT" } }),
      prisma.importBatch.count(),
      prisma.auditLog.count(),
    ]);
    cards.push({ label: "Posisi Kosong", value: vacantPositions });
    cards.push({ label: "Riwayat Impor", value: importBatches });
    cards.push({ label: "Total Peristiwa Audit", value: auditEvents });

    orgUnits = await prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } });

    const contracts = await prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        endDate: { not: null },
        ...(orgUnitId ? { employee: { currentPosition: { orgUnitId } } } : {}),
      },
      include: {
        employee: { include: { currentPosition: { include: { orgUnit: true } } } },
        renewalCaseAsCurrentContract: { select: { id: true } },
      },
    });
    expiringContracts = contracts
      .map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        employeeName: c.employee.fullLegalName,
        orgUnitId: c.employee.currentPosition?.orgUnitId ?? null,
        orgUnitName: c.employee.currentPosition?.orgUnit.unitName ?? "—",
        endDate: c.endDate!,
        urgency: computeExpiryUrgency(c.status, c.endDate),
        hasRenewalCase: !!c.renewalCaseAsCurrentContract,
      }))
      .filter((row) => row.urgency !== "NONE")
      .filter((row) => {
        if (!urgency) return true;
        if (urgency === "DUE_30") return row.urgency === "DUE_30" || row.urgency === "DUE_7" || row.urgency === "EXPIRED";
        if (urgency === "DUE_60") return URGENCY_RANK[row.urgency] <= URGENCY_RANK.DUE_60;
        if (urgency === "DUE_90") return URGENCY_RANK[row.urgency] <= URGENCY_RANK.DUE_90;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "employeeName") cmp = a.employeeName.localeCompare(b.employeeName);
        else if (sortBy === "urgency") cmp = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        else cmp = a.endDate.getTime() - b.endDate.getTime();
        return sortDir === "desc" ? -cmp : cmp;
      });
  }
  if (isTrainingAdmin(session) || isGaAdmin(session)) {
    const positions = await prisma.position.count({ where: { positionStatus: "FILLED" } });
    cards.push({ label: "Posisi Terisi", value: positions });
  }
  if (isGaAdmin(session)) {
    const [totalAssets, inUseAssets, activeCustodies, underRepair] = await Promise.all([
      prisma.fixedAsset.count({ where: { activeFlag: true } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "IN_USE" } }),
      prisma.assetCustody.count({ where: { status: "ACTIVE" } }),
      prisma.fixedAsset.count({ where: { activeFlag: true, status: "UNDER_REPAIR" } }),
    ]);
    cards.push({ label: "Total Aset Aktif", value: totalAssets });
    cards.push({ label: "Sedang Digunakan", value: inUseAssets });
    cards.push({ label: "Total Penguasaan Aktif", value: activeCustodies });
    cards.push({ label: "Dalam Perbaikan", value: underRepair });

    const [openGaRequests, openWorkOrders, openDisposalCases] = await Promise.all([
      prisma.gaRequest.count({
        where: { status: { in: ["SUBMITTED", "PENDING_APPROVAL", "PENDING_LOSS_REVIEW"] } },
      }),
      prisma.maintenanceWorkOrder.count({ where: { status: "OPEN" } }),
      prisma.disposalCase.count({ where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } } }),
    ]);
    cards.push({ label: "Permintaan GA Terbuka", value: openGaRequests });
    cards.push({ label: "Work Order Terbuka", value: openWorkOrders });
    cards.push({ label: "Kasus Disposal Aktif", value: openDisposalCases });
  }
  if (session.user.employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      include: { currentPosition: { include: { job: true, orgUnit: true } } },
    });
    if (employee?.currentPosition) {
      cards.push({ label: "Jabatan Saat Ini", value: employee.currentPosition.job.jobTitle });
      cards.push({ label: "Unit Organisasi", value: employee.currentPosition.orgUnit.unitName });
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">
        {t("nav.dashboard")} — {session.user.name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">Peran: {roleLabels}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
        {cards.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">Tidak ada data ringkasan untuk peran ini.</p>
        )}
      </div>

      {isHrAdmin(session) && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-900">{t("dashboard.expiringContractsTitle")}</p>

          <form className="mt-3 flex flex-wrap items-end gap-3">
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
              <label className="mb-1 block text-xs text-slate-500">{t("dashboard.urgencyFilterLabel")}</label>
              <select
                name="urgency"
                defaultValue={urgency ?? ""}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">{t("dashboard.urgencyFilterAny")}</option>
                <option value="DUE_30">{t("dashboard.urgencyFilterThisMonth")}</option>
                <option value="DUE_60">{t("dashboard.urgencyFilterDue60")}</option>
                <option value="DUE_90">{t("dashboard.urgencyFilterDue90")}</option>
              </select>
            </div>
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t("common.applyFilter")}
            </button>
            {(orgUnitId || urgency) && (
              <Link href="/dashboard" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-700">
                {t("common.resetFilter")}
              </Link>
            )}
          </form>

          {expiringContracts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{t("dashboard.expiringContractsEmpty")}</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <Link href={sortLink({ orgUnitId, urgency }, "employeeName", sortBy, sortDir)} className="hover:underline">
                        {t("dashboard.sortEmployeeName")} {sortBy === "employeeName" && (sortDir === "asc" ? "↑" : "↓")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 font-medium">{t("employee.department")}</th>
                    <th className="px-4 py-3 font-medium">{t("contract.contractNumber")}</th>
                    <th className="px-4 py-3 font-medium">
                      <Link href={sortLink({ orgUnitId, urgency }, "endDate", sortBy, sortDir)} className="hover:underline">
                        {t("dashboard.sortEndDate")} {sortBy === "endDate" && (sortDir === "asc" ? "↑" : "↓")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <Link href={sortLink({ orgUnitId, urgency }, "urgency", sortBy, sortDir)} className="hover:underline">
                        {t("dashboard.sortUrgency")} {sortBy === "urgency" && (sortDir === "asc" ? "↑" : "↓")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.evaluationColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringContracts.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-600">{row.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.orgUnitName}</td>
                      <td className="px-4 py-3">
                        <Link href={`/contracts/${row.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {row.contractNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(row.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            row.urgency === "EXPIRED" || row.urgency === "DUE_7"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {t(`expiryUrgency.${row.urgency}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.hasRenewalCase ? (
                          <Link href={`/contracts/${row.id}`} className="text-xs text-indigo-600 hover:underline">
                            {t("dashboard.viewRenewalCase")}
                          </Link>
                        ) : (
                          <TriggerEvaluationButton contractId={row.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

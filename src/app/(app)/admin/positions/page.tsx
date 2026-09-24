import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SettingsTabs } from "../settings-tabs";
import { CreatePositionForm } from "./create-form";
import type { Prisma, PositionStatus } from "@/generated/prisma/client";

const POSITION_STATUSES: PositionStatus[] = ["PLANNED", "VACANT", "FILLED", "FROZEN", "CLOSED"];

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orgUnitId?: string; jobLevel?: string; positionStatus?: string }>;
}) {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { q, orgUnitId, jobLevel, positionStatus } = await searchParams;

  const where: Prisma.PositionWhereInput = {};
  if (q?.trim()) {
    const query = q.trim();
    where.OR = [
      { positionCode: { contains: query, mode: "insensitive" } },
      { job: { jobTitle: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (orgUnitId) where.orgUnitId = orgUnitId;
  if (jobLevel) where.jobLevel = jobLevel;
  if (positionStatus) where.positionStatus = positionStatus as PositionStatus;

  const [positions, allPositions, jobs, orgUnits, jobLevels, totalCount] = await Promise.all([
    prisma.position.findMany({
      where,
      include: { job: true, orgUnit: true, reportsToPosition: { include: { job: true } } },
      orderBy: { positionCode: "asc" },
    }),
    // The create-form's own "Melapor Ke" picker always offers every
    // Position regardless of the browsing filters above — those two lists
    // serve different purposes and must not be conflated.
    prisma.position.findMany({ orderBy: { positionCode: "asc" } }),
    prisma.job.findMany({ orderBy: { jobTitle: "asc" } }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ distinct: ["jobLevel"], select: { jobLevel: true }, orderBy: { jobLevel: "asc" } }),
    prisma.position.count(),
  ]);

  const hasFilters = !!(q || orgUnitId || jobLevel || positionStatus);

  return (
    <div>
      <SettingsTabs groupId="org" current="/admin/positions" />
      <h1 className="text-lg font-medium text-slate-900">Posisi Organisasi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kursi jabatan yang disetujui. Sebuah posisi dapat kosong dan tetap ada di struktur.
      </p>

      <div className="mt-4">
        <CreatePositionForm jobs={jobs} orgUnits={orgUnits} positions={allPositions} />
      </div>

      <form className="mt-6 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Kode Posisi atau Jabatan"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          {/* Deliberately "Unit Organisasi", not "{t("employee.department")}"
              (Departemen) — a Position can sit at any OrgUnit tier
              (Departemen/Seksi/Grup/Tim), and this list intentionally
              includes all of them so HR Admin can filter by any of them. */}
          <label className="mb-1 block text-xs text-slate-500">Unit Organisasi</label>
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
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select
            name="positionStatus"
            defaultValue={positionStatus ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {POSITION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`positionStatus.${s}`)}
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
            <Link href="/admin/positions" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {hasFilters && (
        <p className="mb-3 text-xs text-slate-400">
          {t("common.filteredCount", { shown: positions.length, total: totalCount })}
        </p>
      )}

      {positions.length === 0 ? (
        <p className="text-sm text-slate-400">{t("common.noFilteredResults")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Jabatan</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Melapor Ke</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{p.positionCode}</td>
                  <td className="px-4 py-3">{p.jobLevel} {p.job.jobTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{p.orgUnit.unitName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.reportsToPosition ? p.reportsToPosition.job.jobTitle : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t(`positionStatus.${p.positionStatus}`)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/positions/${p.id}`} className="text-xs text-indigo-600 hover:underline">
                      {t("common.edit")}
                    </Link>
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

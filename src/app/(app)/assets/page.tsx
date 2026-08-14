import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canViewAssetMaster, canManageAssets } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import type { Prisma } from "@/generated/prisma/client";
import { CreateAssetForm } from "./create-form";

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700",
  IN_USE: "bg-indigo-50 text-indigo-700",
  UNDER_REPAIR: "bg-amber-50 text-amber-700",
  DISPOSED: "bg-slate-100 text-slate-500",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trackingType?: string; status?: string }>;
}) {
  const session = await requireSession();
  if (!canViewAssetMaster(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { q, trackingType, status } = await searchParams;

  const where: Prisma.FixedAssetWhereInput = {};
  if (q?.trim()) {
    const query = q.trim();
    where.OR = [
      { assetCode: { contains: query } },
      { assetName: { contains: query } },
      { category: { contains: query } },
    ];
  }
  if (trackingType === "INDIVIDUAL" || trackingType === "QUANTITY_TRACKED") where.trackingType = trackingType;
  if (status === "AVAILABLE" || status === "IN_USE" || status === "UNDER_REPAIR" || status === "DISPOSED") {
    where.status = status;
  }

  const [assets, filteredCount, totalCount] = await Promise.all([
    prisma.fixedAsset.findMany({
      where,
      orderBy: { assetCode: "asc" },
      include: { _count: { select: { custodies: { where: { status: { not: "RETURNED" } } } } } },
    }),
    prisma.fixedAsset.count({ where }),
    prisma.fixedAsset.count(),
  ]);

  const hasFilters = !!(q || trackingType || status);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("asset.listTitle")}</h1>
          <p className="mt-1 text-xs text-slate-400">{t("common.filteredCount", { shown: filteredCount, total: totalCount })}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/assets/export" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Ekspor Penguasaan
          </a>
          {canManageAssets(session) && (
            <Link href="/import" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              {t("nav.importData")}
            </Link>
          )}
          <Link
            href="/assets/locations"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("asset.locationsNavLabel")}
          </Link>
        </div>
      </div>

      {canManageAssets(session) && (
        <div className="mb-4">
          <CreateAssetForm />
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Kode, nama, atau kategori"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("asset.trackingType")}</label>
          <select name="trackingType" defaultValue={trackingType ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            <option value="INDIVIDUAL">{t("asset.trackingTypeIndividual")}</option>
            <option value="QUANTITY_TRACKED">{t("asset.trackingTypeQuantity")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("asset.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {(["AVAILABLE", "IN_USE", "UNDER_REPAIR", "DISPOSED"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`assetStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/assets" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {assets.length === 0 ? (
        <p className="text-sm text-slate-400">{hasFilters ? t("common.noFilteredResults") : t("asset.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("asset.assetCode")}</th>
                <th className="px-4 py-3 font-medium">{t("asset.assetName")}</th>
                <th className="px-4 py-3 font-medium">{t("asset.trackingType")}</th>
                <th className="px-4 py-3 font-medium">{t("asset.status")}</th>
                <th className="px-4 py-3 font-medium">{t("asset.quantity")}</th>
                <th className="px-4 py-3 font-medium">Penguasaan Aktif</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/assets/${asset.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {asset.assetCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-900">{asset.assetName}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {asset.trackingType === "INDIVIDUAL" ? t("asset.trackingTypeIndividual") : t("asset.trackingTypeQuantity")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_TONE[asset.status]}`}>
                      {t(`assetStatus.${asset.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {asset.trackingType === "QUANTITY_TRACKED" ? `${asset.availableQuantity ?? 0} / ${asset.totalQuantity ?? 0}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{asset._count.custodies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

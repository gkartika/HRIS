import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageAssets, canViewAssetMaster } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateAssetLocationForm } from "./create-form";
import { ToggleAssetLocationForm } from "./toggle-form";

export default async function AssetLocationsPage() {
  const session = await requireSession();
  if (!canViewAssetMaster(session)) {
    return <AccessDenied />;
  }

  const locations = await prisma.assetLocation.findMany({ orderBy: { locationName: "asc" } });
  const canManage = canManageAssets(session);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">{t("asset.locationsTitle")}</h1>
        <Link href="/assets" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("asset.listTitle")}
        </Link>
      </div>

      {canManage && (
        <div className="mb-4">
          <CreateAssetLocationForm />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("asset.locationName")}</th>
              <th className="px-4 py-3 font-medium">{t("asset.description")}</th>
              <th className="px-4 py-3 font-medium">{t("asset.status")}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{loc.locationName}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{loc.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      loc.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {loc.activeFlag ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <ToggleAssetLocationForm locationId={loc.id} currentActive={loc.activeFlag} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {locations.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada lokasi aset.</p>}
      </div>
    </div>
  );
}

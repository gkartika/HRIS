import { StatusChip } from "@/components/status-chip";
import { ASSET_STATUS_TONE, CUSTODY_STATUS_TONE } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canViewAssetMaster, canManageAssets } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { AssignForms } from "./assign-forms";
import { CustodyActions } from "./custody-actions";
import { MarkObsoleteForm } from "./mark-obsolete-form";
import { EditAssetForm } from "./edit-asset-form";
import { Breadcrumbs } from "@/components/breadcrumbs";

function custodyTargetLabel(c: {
  targetType: string;
  employee: { employeeNumber: string; fullLegalName: string } | null;
  orgUnit: { unitName: string } | null;
  location: { locationName: string } | null;
}): string {
  if (c.targetType === "EMPLOYEE" && c.employee) return `${c.employee.employeeNumber} — ${c.employee.fullLegalName}`;
  if (c.targetType === "DEPARTMENT" && c.orgUnit) return c.location ? `${c.orgUnit.unitName} — ${c.location.locationName}` : c.orgUnit.unitName;
  if (c.targetType === "LOCATION" && c.location) return c.location.locationName;
  return "—";
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canViewAssetMaster(session)) {
    return <AccessDenied />;
  }

  const asset = await prisma.fixedAsset.findUnique({
    where: { id },
    include: {
      custodies: {
        orderBy: { assignedAt: "desc" },
        include: {
          employee: { select: { employeeNumber: true, fullLegalName: true } },
          orgUnit: { select: { unitName: true } },
          location: { select: { locationName: true } },
        },
      },
    },
  });
  if (!asset) notFound();

  const canManage = canManageAssets(session);
  const openCustodies = asset.custodies.filter((c) => c.status !== "RETURNED");
  const openDisposalCase = canManage
    ? await prisma.disposalCase.findFirst({ where: { assetId: asset.id, status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } } })
    : null;
  const canAssignMore =
    asset.trackingType === "QUANTITY_TRACKED"
      ? (asset.availableQuantity ?? 0) > 0
      : asset.status === "AVAILABLE" && openCustodies.length === 0;

  let employees: { id: string; employeeNumber: string; fullLegalName: string }[] = [];
  let orgUnits: { id: string; unitName: string }[] = [];
  let locations: { id: string; locationName: string }[] = [];
  if (canManage) {
    [employees, orgUnits, locations] = await Promise.all([
      prisma.employee.findMany({
        where: { activeFlag: true },
        orderBy: { fullLegalName: "asc" },
        select: { id: true, employeeNumber: true, fullLegalName: true },
      }),
      prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
      prisma.assetLocation.findMany({ where: { activeFlag: true }, orderBy: { locationName: "asc" } }),
    ]);
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Aset", href: "/assets" }, { label: "Detail Aset" }]} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-slate-900">{asset.assetName}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_TONE[asset.status]}`}>
              {t(`assetStatus.${asset.status}`)}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{asset.assetCode}</p>
          <p className="mt-1 text-sm text-slate-500">
            {asset.category ?? "—"} · {asset.trackingType === "INDIVIDUAL" ? t("asset.trackingTypeIndividual") : t("asset.trackingTypeQuantity")}
            {asset.trackingType === "QUANTITY_TRACKED" && ` (${asset.availableQuantity ?? 0}/${asset.totalQuantity ?? 0} tersedia)`}
          </p>
          {(asset.assetNumber || asset.modelBrand) && (
            <p className="mt-1 text-sm text-slate-500">
              {[asset.assetNumber && `${t("asset.assetNumber")}: ${asset.assetNumber}`, asset.modelBrand && `${t("asset.modelBrand")}: ${asset.modelBrand}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {asset.specification && (
            <p className="mt-1 text-sm text-slate-500">
              {t("asset.specification")}: {asset.specification}
            </p>
          )}
          {asset.notes && <p className="mt-1 text-xs text-slate-500">{asset.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {canManage && !["RETIRED", "DISPOSED", "PENDING_DISPOSAL"].includes(asset.status) && (
            <Link
              href={`/maintenance/work-orders?newFor=${asset.id}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Buat Work Order
            </Link>
          )}
          {canManage && asset.status !== "RETIRED" && !openDisposalCase && <MarkObsoleteForm assetId={asset.id} />}
        </div>
        {openDisposalCase && (
          <a href={`/disposal-cases/${openDisposalCase.id}`} className="text-xs text-indigo-600 hover:underline">
            Kasus Disposal {openDisposalCase.caseNumber}
          </a>
        )}
      </div>

      {canManage && (
        <EditAssetForm
          asset={{
            id: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
            category: asset.category ?? "",
            assetNumber: asset.assetNumber ?? "",
            modelBrand: asset.modelBrand ?? "",
            specification: asset.specification ?? "",
            trackingType: asset.trackingType,
            totalQuantity: asset.totalQuantity !== null ? String(asset.totalQuantity) : "",
            purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().slice(0, 10) : "",
            purchaseCost: asset.purchaseCost !== null ? String(asset.purchaseCost) : "",
            notes: asset.notes ?? "",
            outNow: asset.trackingType === "QUANTITY_TRACKED" ? (asset.totalQuantity ?? 0) - (asset.availableQuantity ?? 0) : 0,
            hasCustodyHistory: asset.custodies.length > 0,
          }}
        />
      )}

      <h2 className="mt-6 text-sm font-medium text-slate-900">{t("asset.currentCustodyTitle")}</h2>
      {openCustodies.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{t("asset.noCustodyYet")}</p>
      ) : (
        <div className="mt-2 space-y-3">
          {openCustodies.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{custodyTargetLabel(c)}</p>
                  <p className="text-xs text-slate-500">
                    {t(`assetCustodyTargetType.${c.targetType}`)} · Diserahkan {c.assignedAt.toISOString().slice(0, 10)}
                    {asset.trackingType === "QUANTITY_TRACKED" && ` · ${c.quantity} unit`}
                  </p>
                </div>
                <StatusChip tone={CUSTODY_STATUS_TONE[c.status]}>
                  {t(`assetCustodyStatus.${c.status}`)}
                </StatusChip>
              </div>
              {canManage && <CustodyActions custodyId={c.id} employees={employees} orgUnits={orgUnits} locations={locations} />}
            </div>
          ))}
        </div>
      )}

      {canManage && canAssignMore && (
        <div className="mt-6">
          <AssignForms
            assetId={asset.id}
            trackingType={asset.trackingType}
            availableQuantity={asset.availableQuantity ?? 0}
            employees={employees}
            orgUnits={orgUnits}
            locations={locations}
          />
        </div>
      )}

      <h2 className="mt-6 text-sm font-medium text-slate-900">{t("asset.custodyHistoryTitle")}</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Diserahkan Kepada</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tanggal Serah</th>
              <th className="px-4 py-3 font-medium">Tanggal Kembali</th>
              <th className="px-4 py-3 font-medium">Hasil Pemeriksaan</th>
              <th className="px-4 py-3 font-medium">Bukti</th>
            </tr>
          </thead>
          <tbody>
            {asset.custodies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-xs text-slate-400">
                  {t("asset.noCustodyYet")}
                </td>
              </tr>
            )}
            {asset.custodies.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{custodyTargetLabel(c)}</td>
                <td className="px-4 py-3">
                  <StatusChip tone={CUSTODY_STATUS_TONE[c.status]}>
                    {t(`assetCustodyStatus.${c.status}`)}
                  </StatusChip>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.assignedAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.returnedAt ? c.returnedAt.toISOString().slice(0, 10) : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {c.inspectionResult ? t(`assetInspectionResult.${c.inspectionResult}`) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-indigo-600">
                  <div className="flex flex-col gap-1">
                    {c.handoverEvidenceFileId && (
                      <a href={`/api/files/${c.handoverEvidenceFileId}`} target="_blank" rel="noreferrer" className="hover:underline">
                        Serah Terima
                      </a>
                    )}
                    {c.returnEvidenceFileId && (
                      <a href={`/api/files/${c.returnEvidenceFileId}`} target="_blank" rel="noreferrer" className="hover:underline">
                        Pengembalian
                      </a>
                    )}
                    {!c.handoverEvidenceFileId && !c.returnEvidenceFileId && "—"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

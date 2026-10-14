import { StatusChip } from "@/components/status-chip";
import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { NewWorkOrderForm } from "./new-work-order-form";

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};

export default async function MaintenanceWorkOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; newFor?: string }> }) {
  const session = await requireSession();
  if (!canManageGaOperations(session)) {
    return <AccessDenied />;
  }

  const { page: pageRaw, newFor } = await searchParams;
  const { page, skip, take } = pageParams(pageRaw);
  const [workOrders, total, assetChoices] = await Promise.all([
    prisma.maintenanceWorkOrder.findMany({
      skip,
      take,
      include: { asset: { select: { assetCode: true, assetName: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.maintenanceWorkOrder.count(),
    // Anything that can still be worked on: not retired and not waiting for disposal.
    prisma.fixedAsset.findMany({
      where: { activeFlag: true, status: { notIn: ["RETIRED", "DISPOSED", "PENDING_DISPOSAL"] } },
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, assetName: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Work Order Perawatan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Work order dibuat dari laporan kerusakan, rencana perawatan, pengembalian aset yang perlu perbaikan, atau langsung lewat tombol Buat Work Order.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/maintenance/export" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Ekspor
          </a>
          <NewWorkOrderForm
            assets={assetChoices.map((a) => ({ id: a.id, label: `${a.assetCode} — ${a.assetName}` }))}
            defaultAssetId={assetChoices.some((a) => a.id === newFor) ? newFor : ""}
            defaultOpen={!!newFor && assetChoices.some((a) => a.id === newFor)}
          />
        </div>
      </div>

      {workOrders.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada work order.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Aset</th>
                <th className="px-4 py-3 font-medium">Sumber</th>
                <th className="px-4 py-3 font-medium">Tipe Pekerjaan</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((w) => (
                <tr key={w.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/maintenance/work-orders/${w.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {w.workOrderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {w.asset.assetName} ({w.asset.assetCode})
                  </td>
                  <td className="px-4 py-3 text-slate-600">{w.sourceType === "PREVENTIVE" ? "Preventif" : "Korektif"}</td>
                  <td className="px-4 py-3 text-slate-600">{w.workType === "INTERNAL" ? "Internal" : "Vendor"}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={STATUS_TONE[w.status]}>
                      {w.status === "OPEN" ? "Terbuka" : "Selesai"}
                    </StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} basePath="/maintenance/work-orders" params={{}} />
    </div>
  );
}

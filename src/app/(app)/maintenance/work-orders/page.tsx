import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { CorrectiveSourceForm } from "./corrective-source-form";

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};

export default async function MaintenanceWorkOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession();
  if (!canManageGaOperations(session)) {
    return <AccessDenied />;
  }

  const { page: pageRaw } = await searchParams;
  const { page, skip, take } = pageParams(pageRaw);
  const [workOrders, total, pendingCorrectiveRequests, existingSourceRequestIds] = await Promise.all([
    prisma.maintenanceWorkOrder.findMany({
      skip,
      take,
      include: { asset: { select: { assetCode: true, assetName: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.maintenanceWorkOrder.count(),
    prisma.gaRequest.findMany({
      where: { requestType: "DAMAGE_OR_ABNORMAL_CONDITION", status: "WORK_ORDER_CREATED" },
      include: { asset: { select: { assetCode: true, assetName: true } } },
      orderBy: { verifiedAt: "asc" },
    }),
    prisma.maintenanceWorkOrder.findMany({ where: { sourceGaRequestId: { not: null } }, select: { sourceGaRequestId: true } }),
  ]);

  const requestsWithWorkOrder = new Set(existingSourceRequestIds.map((w) => w.sourceGaRequestId));
  const requestsNeedingWorkOrder = pendingCorrectiveRequests.filter((r) => !requestsWithWorkOrder.has(r.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Work Order Perawatan</h1>
          <p className="mt-1 text-sm text-slate-500">Work order preventif dan korektif.</p>
        </div>
        <a href="/api/maintenance/export" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Ekspor
        </a>
      </div>

      {requestsNeedingWorkOrder.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">Permintaan Menunggu Work Order Korektif</p>
          <div className="mt-3 space-y-3">
            {requestsNeedingWorkOrder.map((r) => (
              <div key={r.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-sm text-slate-900">
                  <Link href={`/ga-requests/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                    {r.requestNumber}
                  </Link>{" "}
                  — {r.asset ? `${r.asset.assetName} (${r.asset.assetCode})` : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{r.description}</p>
                <div className="mt-2">
                  <CorrectiveSourceForm requestId={r.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_TONE[w.status]}`}>
                      {w.status === "OPEN" ? "Terbuka" : "Selesai"}
                    </span>
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

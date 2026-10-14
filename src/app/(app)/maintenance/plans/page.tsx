import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { formatDateMedium } from "@/lib/format";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { daysUntil } from "@/lib/ga-home";
import { planDueState } from "@/lib/ga-operations";
import { CreatePlanForm } from "./create-plan-form";
import { CreateWorkOrderFromPlanForm, DeactivatePlanButton } from "./plan-row-actions";

function intervalText(days: number | null, km: number | null): string {
  const parts = [days ? `${days} hari` : null, km ? `${km.toLocaleString("id-ID")} km` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

export default async function MaintenancePlansPage() {
  const session = await requireSession();
  if (!canManageGaOperations(session)) {
    return <AccessDenied />;
  }

  const [plans, assets] = await Promise.all([
    prisma.maintenancePlan.findMany({
      include: { asset: { select: { assetCode: true, assetName: true } } },
      orderBy: [{ activeFlag: "desc" }, { dueDate: "asc" }],
    }),
    prisma.fixedAsset.findMany({ where: { activeFlag: true }, orderBy: { assetCode: "asc" }, select: { id: true, assetCode: true, assetName: true } }),
  ]);
  const openOrders = await prisma.maintenanceWorkOrder.findMany({
    where: { sourcePlanId: { in: plans.map((p) => p.id) }, status: "OPEN" },
    select: { id: true, workOrderNumber: true, sourcePlanId: true },
  });
  const openByPlan = new Map(openOrders.map((w) => [w.sourcePlanId, w]));

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">Rencana Perawatan Preventif</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rencana yang diatur otomatis membuat work order sendiri saat jatuh tempo. Setelah hasilnya dicatat, jatuh tempo berikutnya dihitung dari interval.
        </p>
      </div>

      <CreatePlanForm assets={assets.map((a) => ({ id: a.id, label: `${a.assetCode} — ${a.assetName}` }))} />

      {plans.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada rencana perawatan.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Aset</th>
                <th className="px-4 py-3 font-medium">Deskripsi</th>
                <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                <th className="px-4 py-3 font-medium">Interval</th>
                <th className="px-4 py-3 font-medium">Work Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const days = p.activeFlag && p.dueDate ? daysUntil(p.dueDate, now) : null;
                const state = planDueState(days);
                const open = openByPlan.get(p.id);
                return (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-600">
                      {p.asset.assetName} ({p.asset.assetCode})
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.description}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{formatDateMedium(p.dueDate)}</div>
                      {p.dueKm !== null && <div className="text-xs text-slate-400">atau {p.dueKm.toLocaleString("id-ID")} km</div>}
                      {state === "OVERDUE" && days !== null && (
                        <span className="mt-1 inline-block rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Terlambat {-days} hari</span>
                      )}
                      {state === "SOON" && days !== null && (
                        <span className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {days === 0 ? "Jatuh tempo hari ini" : `${days} hari lagi`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{intervalText(p.intervalDays, p.intervalKm)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`rounded-md px-2 py-1 font-medium ${p.autoCreateWorkOrder ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.autoCreateWorkOrder ? "Otomatis" : "Manual"}
                      </span>
                      {open && (
                        <div className="mt-1">
                          <Link href={`/maintenance/work-orders/${open.id}`} className="text-indigo-600 hover:underline">
                            {open.workOrderNumber}
                          </Link>{" "}
                          <span className="text-slate-400">terbuka</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${p.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.activeFlag ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.activeFlag && (
                        <div className="flex flex-col items-start gap-2">
                          {!open && <CreateWorkOrderFromPlanForm planId={p.id} />}
                          <DeactivatePlanButton planId={p.id} />
                        </div>
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

import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { formatDateMedium } from "@/lib/format";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { CreatePlanForm } from "./create-plan-form";
import { CreateWorkOrderFromPlanForm, DeactivatePlanButton } from "./plan-row-actions";

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

  const today = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">Rencana Perawatan Preventif</h1>
        <p className="mt-1 text-sm text-slate-500">Jadwal perawatan preventif berdasarkan tanggal, interval hari, atau kilometer.</p>
      </div>

      <CreatePlanForm assets={assets.map((a) => ({ id: a.id, label: `${a.assetCode} — ${a.assetName}` }))} />

      {plans.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada rencana perawatan.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Aset</th>
                <th className="px-4 py-3 font-medium">Deskripsi</th>
                <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const isDue = p.activeFlag && p.dueDate && p.dueDate <= today;
                return (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-600">
                      {p.asset.assetName} ({p.asset.assetCode})
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.description}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateMedium(p.dueDate)}
                      {isDue && <span className="ml-2 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Jatuh Tempo</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${p.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.activeFlag ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.activeFlag && (
                        <div className="flex flex-col items-start gap-2">
                          <CreateWorkOrderFromPlanForm planId={p.id} />
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

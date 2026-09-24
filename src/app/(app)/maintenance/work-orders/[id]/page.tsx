import { notFound } from "next/navigation";
import { formatDateLong } from "@/lib/format";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { canExecuteMaintenanceWorkOrder } from "@/lib/ga-operations";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ExecuteMaintenanceForm } from "./execute-form";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function MaintenanceWorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageGaOperations(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const workOrder = await prisma.maintenanceWorkOrder.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, assetCode: true, assetName: true } },
      createdByAccount: { select: { usernameOrEmail: true } },
      completedByAccount: { select: { usernameOrEmail: true } },
      evidenceFile: true,
    },
  });
  if (!workOrder) notFound();

  const canExecute = canExecuteMaintenanceWorkOrder(workOrder.status);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Work Order", href: "/maintenance/work-orders" }, { label: "Detail Work Order" }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{workOrder.workOrderNumber}</h1>
        <p className="mt-1 text-sm text-slate-500">
          <Link href={`/assets/${workOrder.asset.id}`} className="text-indigo-600 hover:underline">
            {workOrder.asset.assetName} ({workOrder.asset.assetCode})
          </Link>{" "}
          — {workOrder.sourceType === "PREVENTIVE" ? "Preventif" : "Korektif"}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Tipe Pekerjaan</p>
            <p className="mt-1 text-slate-900">{workOrder.workType === "INTERNAL" ? "Internal" : "Vendor"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 text-slate-900">{workOrder.status === "OPEN" ? "Terbuka" : "Selesai"}</p>
          </div>
          {workOrder.checklistNotes && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Checklist</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-900">{workOrder.checklistNotes}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">Dibuat</p>
            <p className="mt-1 text-slate-900">{workOrder.createdByAccount.usernameOrEmail}</p>
          </div>
        </div>
      </div>

      {workOrder.status === "COMPLETED" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Hasil Pelaksanaan</p>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Tanggal Servis</p>
              <p className="mt-1 text-slate-900">{formatDateLong(workOrder.serviceDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">KM</p>
              <p className="mt-1 text-slate-900">{workOrder.odometerKm ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Diagnosis</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-900">{workOrder.diagnosisNote ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Tindakan</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-900">{workOrder.actionTakenNote}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Biaya</p>
              <p className="mt-1 text-slate-900">{workOrder.cost ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Hasil</p>
              <p className="mt-1 text-slate-900">{workOrder.outcome === "OPERATIONAL" ? "Operasional" : "Tidak Dapat Diperbaiki"}</p>
            </div>
            {workOrder.evidenceFile && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Bukti</p>
                <a href={`/api/files/${workOrder.evidenceFile.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                  {workOrder.evidenceFile.originalFileName}
                </a>
              </div>
            )}
            {workOrder.nextDueDate && (
              <div>
                <p className="text-xs text-slate-500">Jatuh Tempo Berikutnya</p>
                <p className="mt-1 text-slate-900">{formatDateLong(workOrder.nextDueDate)}</p>
              </div>
            )}
            <div className="col-span-2 text-xs text-slate-500">
              Diselesaikan {formatDateLong(workOrder.completedAt)} — {workOrder.completedByAccount?.usernameOrEmail}
            </div>
          </div>
          {workOrder.outcome === "BEYOND_REPAIR" && (
            <p className="mt-3 text-xs text-slate-500">
              Kasus disposal telah dibuat otomatis. Lihat{" "}
              <Link href="/disposal-cases" className="text-indigo-600 hover:underline">
                Kasus Disposal
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        canExecute && <ExecuteMaintenanceForm workOrderId={workOrder.id} />
      )}
    </div>
  );
}

import { GA_REQUEST_STATUS_LABEL } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { formatDateLong } from "@/lib/format";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canViewGaRequest, canManageGaOperations, canCancelGaRequest } from "@/lib/permissions";
import {
  canVerifyGaRequest,
  canDecideGaRequest,
  canProcessGaRequest,
  canReviewGaRequestLoss,
  canCancelGaRequestStatus,
  canDecideDamageRequest,
} from "@/lib/ga-operations";
import { prisma } from "@/lib/db";
import { VerifyForm, ApproverDecisionButtons, ProcessForm, LossReviewButtons, CancelRequestForm, DamageDecisionPanel } from "./decision-forms";
import { Breadcrumbs } from "@/components/breadcrumbs";

const TYPE_LABEL: Record<string, string> = {
  NEW_ASSET_NEED: "Kebutuhan Aset Baru",
  DAMAGE_OR_ABNORMAL_CONDITION: "Kerusakan / Kondisi Tidak Normal",
  LOSS: "Kehilangan",
};

export default async function GaRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.gaRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, employeeNumber: true, fullLegalName: true } },
      asset: { select: { id: true, assetCode: true, assetName: true, status: true } },
      location: { select: { locationName: true } },
      verifiedByAccount: { select: { usernameOrEmail: true } },
      decisionByAccount: { select: { usernameOrEmail: true } },
      processedByAccount: { select: { usernameOrEmail: true } },
      lossReviewedByAccount: { select: { usernameOrEmail: true } },
      cancelledByAccount: { select: { usernameOrEmail: true } },
      evidenceFile: true,
    },
  });
  if (!request) notFound();

  if (!canViewGaRequest(session, request.requesterEmployeeId)) {
    return <AccessDenied />;
  }

  const isGaAdminUser = canManageGaOperations(session);
  // Only a new-asset need still goes through a separate verification step.
  const canVerify = isGaAdminUser && canVerifyGaRequest(request.status) && request.requestType === "NEW_ASSET_NEED";
  const canDecideDamage = isGaAdminUser && request.requestType === "DAMAGE_OR_ABNORMAL_CONDITION" && canDecideDamageRequest(request.status);
  const workOrder =
    request.requestType === "DAMAGE_OR_ABNORMAL_CONDITION"
      ? await prisma.maintenanceWorkOrder.findFirst({
          where: { sourceGaRequestId: request.id },
          select: { id: true, workOrderNumber: true, status: true, outcome: true },
        })
      : null;
  const canDecideApprover = isGaAdminUser && canDecideGaRequest(request.status);
  const canProcess = isGaAdminUser && canProcessGaRequest(request.status);
  const canReviewLoss = isGaAdminUser && canReviewGaRequestLoss(request.status);
  const canCancel = canCancelGaRequest(session, request.requesterEmployeeId) && canCancelGaRequestStatus(request.status);

  let processFormData: {
    assets: { id: string; label: string; trackingType: string; availableQuantity: number | null }[];
    employees: { id: string; label: string }[];
    orgUnits: { id: string; label: string }[];
    locations: { id: string; label: string }[];
  } | null = null;
  if (canProcess) {
    const [assets, employees, orgUnits, locations] = await Promise.all([
      prisma.fixedAsset.findMany({
        where: { activeFlag: true, OR: [{ trackingType: "INDIVIDUAL", status: "AVAILABLE" }, { trackingType: "QUANTITY_TRACKED", availableQuantity: { gt: 0 } }] },
        orderBy: { assetCode: "asc" },
      }),
      prisma.employee.findMany({
        where: { activeFlag: true },
        orderBy: { fullLegalName: "asc" },
        select: { id: true, employeeNumber: true, fullLegalName: true },
      }),
      prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
      prisma.assetLocation.findMany({ where: { activeFlag: true }, orderBy: { locationName: "asc" } }),
    ]);
    processFormData = {
      assets: assets.map((a) => ({
        id: a.id,
        label: `${a.assetCode} — ${a.assetName}`,
        trackingType: a.trackingType,
        availableQuantity: a.availableQuantity,
      })),
      employees: employees.map((e) => ({ id: e.id, label: `${e.employeeNumber} — ${e.fullLegalName}` })),
      orgUnits: orgUnits.map((u) => ({ id: u.id, label: u.unitName })),
      locations: locations.map((l) => ({ id: l.id, label: l.locationName })),
    };
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Permintaan GA", href: "/ga-requests" }, { label: "Detail Permintaan" }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{request.requestNumber}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {TYPE_LABEL[request.requestType]} — {request.requester.fullLegalName} (
          {request.requester.employeeNumber})
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 text-slate-900">{GA_REQUEST_STATUS_LABEL[request.status]}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Urgensi</p>
            <p className="mt-1 text-slate-900">{request.urgency}</p>
          </div>
          {request.asset && (
            <div>
              <p className="text-xs text-slate-500">Aset</p>
              <p className="mt-1 text-slate-900">
                <Link href={`/assets/${request.asset.id}`} className="text-indigo-600 hover:underline">
                  {request.asset.assetName} ({request.asset.assetCode})
                </Link>
              </p>
            </div>
          )}
          {request.location && (
            <div>
              <p className="text-xs text-slate-500">Lokasi</p>
              <p className="mt-1 text-slate-900">{request.location.locationName}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-xs text-slate-500">Deskripsi</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-900">{request.description}</p>
          </div>
          {request.evidenceFile && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Bukti</p>
              <a href={`/api/files/${request.evidenceFile.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                {request.evidenceFile.originalFileName}
              </a>
            </div>
          )}
        </div>
      </div>

      {(request.requestType === "NEW_ASSET_NEED" || request.verifiedAt) && (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-900">Verifikasi GA Admin</p>
        {request.verifiedAt && (
          <p className="mt-2 text-xs text-slate-500">
            {formatDateLong(request.verifiedAt)} — {request.verifiedByAccount?.usernameOrEmail ?? "—"}
            {request.verificationNote && `: ${request.verificationNote}`}
          </p>
        )}
        {canVerify && <VerifyForm requestId={request.id} />}
      </div>
      )}

      {request.requestType === "NEW_ASSET_NEED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Persetujuan Kebutuhan Aset Baru</p>
          {request.approvalRequired === false && request.status !== "SUBMITTED" && (
            <p className="mt-2 text-xs text-slate-500">Tidak memerlukan persetujuan — diproses langsung.</p>
          )}
          {request.decisionAt && (
            <p className="mt-2 text-xs text-slate-500">
              {formatDateLong(request.decisionAt)} — {request.decisionByAccount?.usernameOrEmail ?? "—"}
              {request.decisionNote && `: ${request.decisionNote}`}
            </p>
          )}
          {canDecideApprover && <ApproverDecisionButtons requestId={request.id} />}

          {(request.status === "APPROVED" || request.status === "PROCESSED") && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-900">Pemrosesan</p>
              {request.processedAt ? (
                <p className="mt-2 text-xs text-slate-500">
                  {formatDateLong(request.processedAt)} — {request.processedByAccount?.usernameOrEmail ?? "—"}
                  {request.procurementReference && ` — Referensi: ${request.procurementReference}`}
                  {request.resultingCustodyId && ` — Custody: ${request.resultingCustodyId}`}
                </p>
              ) : (
                canProcess &&
                processFormData && (
                  <ProcessForm
                    requestId={request.id}
                    assets={processFormData.assets}
                    employees={processFormData.employees}
                    orgUnits={processFormData.orgUnits}
                    locations={processFormData.locations}
                    defaultEmployeeId={request.requesterEmployeeId}
                  />
                )
              )}
            </div>
          )}
        </div>
      )}

      {request.requestType === "DAMAGE_OR_ABNORMAL_CONDITION" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Perbaikan</p>
          {canDecideDamage && <DamageDecisionPanel requestId={request.id} />}
          {request.status === "REJECTED" && request.decisionNote && (
            <p className="mt-2 text-xs text-slate-500">
              Ditolak {formatDateLong(request.decisionAt)} — {request.decisionByAccount?.usernameOrEmail ?? "—"}: {request.decisionNote}
            </p>
          )}
          {workOrder && (
            <p className="mt-2 text-sm text-slate-700">
              Work order{" "}
              <Link href={`/maintenance/work-orders/${workOrder.id}`} className="text-indigo-600 hover:underline">
                {workOrder.workOrderNumber}
              </Link>{" "}
              — {workOrder.status === "OPEN" ? "terbuka, menunggu hasil perbaikan" : workOrder.outcome === "BEYOND_REPAIR" ? "selesai, rusak berat (draf disposal dibuat)" : "selesai, aset berfungsi lagi"}
            </p>
          )}
          {!workOrder && request.status === "WORK_ORDER_CREATED" && (
            <p className="mt-1 text-xs text-slate-500">
              Buat work order dari{" "}
              <Link href="/maintenance/work-orders" className="text-indigo-600 hover:underline">
                Work Order Perawatan
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {request.requestType === "LOSS" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Peninjauan Kehilangan</p>
          {request.lossReviewedAt && (
            <p className="mt-2 text-xs text-slate-500">
              {formatDateLong(request.lossReviewedAt)} — {request.lossReviewedByAccount?.usernameOrEmail ?? "—"}
              {request.lossReviewNote && `: ${request.lossReviewNote}`}
            </p>
          )}
          {request.status === "LOSS_CONFIRMED" && (
            <p className="mt-1 text-xs text-slate-500">
              Kasus disposal telah dibuat otomatis. Lihat{" "}
              <Link href="/disposal-cases" className="text-indigo-600 hover:underline">
                Kasus Disposal
              </Link>
              .
            </p>
          )}
          {canReviewLoss && <LossReviewButtons requestId={request.id} needsEvidence={!request.evidenceFile} />}
        </div>
      )}

      {request.cancelledAt && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <p className="text-sm font-medium text-rose-800">
            Dibatalkan {formatDateLong(request.cancelledAt)} — {request.cancelledByAccount?.usernameOrEmail ?? "—"}
          </p>
          {request.cancellationReason && <p className="mt-1 text-xs text-rose-700">{request.cancellationReason}</p>}
        </div>
      )}

      {canCancel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <CancelRequestForm requestId={request.id} />
        </div>
      )}
    </div>
  );
}

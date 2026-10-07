import { StatusChip } from "@/components/status-chip";
import { GA_REQUEST_STATUS_LABEL } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations, canSubmitGaRequest } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EmptyState } from "@/components/empty-state";
import type { Prisma, GaRequestStatus, GaRequestType } from "@/generated/prisma/client";

const REQUEST_TYPES: GaRequestType[] = ["NEW_ASSET_NEED", "DAMAGE_OR_ABNORMAL_CONDITION", "LOSS"];
const REQUEST_STATUSES: GaRequestStatus[] = [
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PROCESSED",
  "WORK_ORDER_CREATED",
  "PENDING_LOSS_REVIEW",
  "LOSS_CONFIRMED",
  "LOSS_NOT_CONFIRMED",
  "CANCELLED",
];

const TYPE_LABEL: Record<GaRequestType, string> = {
  NEW_ASSET_NEED: "Kebutuhan Aset Baru",
  DAMAGE_OR_ABNORMAL_CONDITION: "Kerusakan / Kondisi Tidak Normal",
  LOSS: "Kehilangan",
};

const STATUS_TONE: Record<GaRequestStatus, string> = {
  SUBMITTED: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  PROCESSED: "bg-indigo-50 text-indigo-700",
  WORK_ORDER_CREATED: "bg-amber-50 text-amber-700",
  PENDING_LOSS_REVIEW: "bg-amber-50 text-amber-700",
  LOSS_CONFIRMED: "bg-rose-50 text-rose-700",
  LOSS_NOT_CONFIRMED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-slate-100 text-slate-400",
};

export default async function GaRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; requestType?: string; status?: string }>;
}) {
  const session = await requireSession();
  const isGaAdminUser = canManageGaOperations(session);

  if (!isGaAdminUser && !canSubmitGaRequest(session)) {
    return <AccessDenied />;
  }

  const { requestType, status, page: pageRaw } = await searchParams;

  // "Requester sees only own requests" — GA Admin sees everything, anyone
  // else sees only what they submitted themselves. Approvers reach a
  // specific pending request via the Approval Inbox link, not this list.
  const where: Prisma.GaRequestWhereInput = isGaAdminUser ? {} : { requesterEmployeeId: session.user.employeeId ?? "__none__" };
  if (requestType) where.requestType = requestType as GaRequestType;
  if (status) where.status = status as GaRequestStatus;

  const { page, skip, take } = pageParams(pageRaw);
  const [total, requests] = await Promise.all([
    prisma.gaRequest.count({ where }),
    prisma.gaRequest.findMany({
      skip,
      take,
    where,
    include: {
      requester: { select: { employeeNumber: true, fullLegalName: true } },
      asset: { select: { assetName: true, assetCode: true } },
    },
    orderBy: { submittedAt: "desc" },
  })]);

  const hasFilters = !!(requestType || status);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">Permintaan GA Operations</h1>
        <div className="flex gap-2">
          {isGaAdminUser && (
            <a
              href={`/api/ga-requests/export?${new URLSearchParams({ ...(requestType ? { requestType } : {}), ...(status ? { status } : {}) }).toString()}`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Ekspor
            </a>
          )}
          <Link href="/ga-requests/new" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Buat Permintaan Baru
          </Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Jenis Permintaan</label>
          <select name="requestType" defaultValue={requestType ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {REQUEST_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {TYPE_LABEL[tp]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GA_REQUEST_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/ga-requests" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {requests.length === 0 ? (
        <EmptyState message="Belum ada permintaan." action={{ href: "/ga-requests/new", label: "Buat Permintaan" }} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Pemohon</th>
                <th className="px-4 py-3 font-medium">Aset</th>
                <th className="px-4 py-3 font-medium">Urgensi</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/ga-requests/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[r.requestType]}</td>
                  <td className="px-4 py-3">{r.requester.fullLegalName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.asset ? `${r.asset.assetName} (${r.asset.assetCode})` : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.urgency}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={STATUS_TONE[r.status]}>{GA_REQUEST_STATUS_LABEL[r.status]}</StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} basePath="/ga-requests" params={{ requestType, status }} />
    </div>
  );
}

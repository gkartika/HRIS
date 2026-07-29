import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import type { Prisma, MovementRequestStatus, MovementType } from "@/generated/prisma/client";

const MOVEMENT_STATUSES: MovementRequestStatus[] = ["SUBMITTED", "APPROVED", "REJECTED", "IMPLEMENTED", "CANCELLED"];
const MOVEMENT_TYPES: MovementType[] = ["PROMOTION", "ROTATION", "MUTATION", "DEMOTION", "STATUS_CHANGE"];

export default async function MovementListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; movementType?: string }>;
}) {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isHrManagerNow = hrManagerPositions.length > 0;
  const seesAll = isHrAdmin(session) || isHrManagerNow;

  const { status, movementType } = await searchParams;

  const where: Prisma.MovementRequestWhereInput = seesAll
    ? {}
    : {
        OR: [
          { requesterEmployeeId: session.user.employeeId ?? "__none__" },
          { employeeId: session.user.employeeId ?? "__none__" },
        ],
      };
  if (status) where.status = status as MovementRequestStatus;
  if (movementType) where.movementType = movementType as MovementType;

  const requests = await prisma.movementRequest.findMany({
    where,
    include: {
      employee: true,
      currentPosition: { include: { job: true } },
      proposedPosition: { include: { job: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const hasFilters = !!(status || movementType);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("movement.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("movement.listSubtitle")}</p>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {MOVEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`movementStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.movementType")}</label>
          <select
            name="movementType"
            defaultValue={movementType ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {MOVEMENT_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {t(`movementType.${mt}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/movements" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">
          {hasFilters ? t("common.noFilteredResults") : t("movement.emptyState")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("movement.requestNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("movement.movementType")}</th>
                <th className="px-4 py-3 font-medium">{t("movement.fromTo")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/movements/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.employee.preferredName ?? r.employee.fullLegalName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t(`movementType.${r.movementType}`)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.currentPosition.job.jobTitle} → {r.proposedPosition.job.jobTitle}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {t(`movementStatus.${r.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

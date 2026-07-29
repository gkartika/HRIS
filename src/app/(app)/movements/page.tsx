import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

export default async function MovementListPage() {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isHrManagerNow = hrManagerPositions.length > 0;
  const seesAll = isHrAdmin(session) || isHrManagerNow;

  const requests = await prisma.movementRequest.findMany({
    where: seesAll
      ? {}
      : {
          OR: [
            { requesterEmployeeId: session.user.employeeId ?? "__none__" },
            { employeeId: session.user.employeeId ?? "__none__" },
          ],
        },
    include: {
      employee: true,
      currentPosition: { include: { job: true } },
      proposedPosition: { include: { job: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("movement.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("movement.listSubtitle")}</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">{t("movement.emptyState")}</p>
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

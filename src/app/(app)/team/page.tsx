import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

export default async function TeamPage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const me = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { currentPositionId: true },
  });

  const directReportPositions = me?.currentPositionId
    ? await prisma.position.findMany({
        where: { reportsToPositionId: me.currentPositionId },
        include: { job: true, orgUnit: true, currentHolders: true },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("nav.myTeam")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Posisi yang melapor langsung ke posisi Anda saat ini (reports_to_position_id).
      </p>

      <div className="mt-4 space-y-2">
        {directReportPositions.length === 0 && (
          <p className="text-sm text-slate-400">Belum ada posisi yang melapor kepada Anda.</p>
        )}
        {directReportPositions.map((position) => (
          <div
            key={position.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{position.job.jobTitle}</p>
              <p className="text-xs text-slate-500">{position.orgUnit.unitName}</p>
            </div>
            <div className="text-right">
              {position.currentHolders.length === 0 ? (
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  {t("positionStatus.VACANT")}
                </span>
              ) : (
                position.currentHolders.map((holder) => (
                  <Link
                    key={holder.id}
                    href={`/employees/${holder.id}`}
                    className="block text-sm text-indigo-600 hover:underline"
                  >
                    {holder.preferredName ?? holder.fullLegalName}
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

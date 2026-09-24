import { requireSession } from "@/lib/require-session";
import { formatDateLong } from "@/lib/format";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// ACC-15/DSH-13: "My Positions" — every active Assignment this employee
// currently holds, always reconstructed live from Assignment rows (never a
// cached list) so it reflects the same effective-dated truth the org chart
// and HR Manager access derivation both use.
export default async function MyPositionsPage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const now = new Date();
  const assignments = await prisma.assignment.findMany({
    where: {
      employeeId: session.user.employeeId,
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    include: { position: { include: { job: true, orgUnit: true } } },
    orderBy: { effectiveFrom: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("hrManagerUi.myPositionsTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("hrManagerUi.myPositionsSubtitle")}</p>

      {assignments.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t("hrManagerUi.noActivePositions")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {a.position.job.jobTitle}{" "}
                    <span className="font-mono text-xs text-slate-400">({a.position.positionCode})</span>
                  </p>
                  <p className="text-xs text-slate-500">{a.position.orgUnit.unitName}</p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {t(`assignmentType.${a.assignmentType}`)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {t("assignmentUi.effectiveFrom")}: {formatDateLong(a.effectiveFrom)}
              </p>
              {a.position.grantsHrManagerAccess && (
                <span className="mt-2 inline-block rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                  {t("hrManagerUi.grantsHrManagerAccessBadge")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

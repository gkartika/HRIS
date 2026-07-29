import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// ACC-15/DSH-04/DSH-12: personal Approval Inbox — Recruitment Requests
// currently awaiting a decision from THIS HR Manager. Scoped by the live
// active-HR-Manager-position check, same derivation used to gate the
// approve/reject/return controls themselves (WF-15).
export default async function ApprovalsPage() {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);

  if (hrManagerPositions.length === 0) {
    return <p className="text-sm text-rose-600">{t("hrManagerUi.notHrManager")}</p>;
  }

  const pendingRequests = await prisma.recruitmentRequest.findMany({
    where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    include: { department: true, job: true },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("hrManagerUi.approvalInboxTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("hrManagerUi.approvalInboxSubtitle")}</p>

      {pendingRequests.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("recruitment.requestNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.department")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.job")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/recruitment/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.department.unitName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.job.jobTitle}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      {t(`recruitmentStatus.${r.status}`)}
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

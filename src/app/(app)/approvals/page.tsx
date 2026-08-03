import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// ACC-15/DSH-04/DSH-12: personal Approval Inbox — every Recruitment Request
// or Movement Request currently awaiting a decision from THIS HR Manager,
// plus (added per direct user request) every Recruitment Request awaiting
// this employee's own Department Manager/Head (Job level 3B) decision in
// whichever department(s) they hold that authority — the two personas share
// this one inbox rather than getting separate pages.
export default async function ApprovalsPage() {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);

  if (hrManagerPositions.length === 0 && deptHeadDepartmentIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("hrManagerUi.notHrManager")}</p>;
  }

  const [pendingRequests, pendingMovements, pendingDeptHeadRequests, pendingDeptHeadMovements] = await Promise.all([
    prisma.recruitmentRequest.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      include: { department: true, job: true },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.movementRequest.findMany({
      where: { status: "SUBMITTED" },
      include: { employee: true, currentPosition: { include: { job: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    deptHeadDepartmentIds.length > 0
      ? prisma.recruitmentRequest.findMany({
          where: { status: "PENDING_DEPT_HEAD", departmentId: { in: deptHeadDepartmentIds } },
          include: { department: true, job: true },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    // Perubahan Posisi refactor: same dept-head-scoped queue, but
    // department isn't a direct field on MovementRequest — derived from
    // currentPosition.orgUnit (itself or its Section-tier parent).
    deptHeadDepartmentIds.length > 0
      ? prisma.movementRequest.findMany({
          where: {
            status: "PENDING_DEPT_HEAD",
            currentPosition: {
              orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
            },
          },
          include: { employee: true, currentPosition: { include: { job: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">{t("hrManagerUi.approvalInboxTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("hrManagerUi.approvalInboxSubtitle")}</p>
      </div>

      {deptHeadDepartmentIds.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">{t("recruitment.deptHeadApprovalSectionTitle")}</h2>
          {pendingDeptHeadRequests.length === 0 ? (
            <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                  {pendingDeptHeadRequests.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <Link href={`/recruitment/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {r.requestNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.department.unitName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.job?.jobTitle ?? "—"}</td>
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
      )}

      {deptHeadDepartmentIds.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">
            {t("recruitment.deptHeadApprovalSectionTitle")} — {t("movement.navLabel")}
          </h2>
          {pendingDeptHeadMovements.length === 0 ? (
            <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("movement.requestNumber")}</th>
                    <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                    <th className="px-4 py-3 font-medium">{t("movement.movementType")}</th>
                    <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDeptHeadMovements.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <Link href={`/movements/${m.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {m.requestNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.employee.preferredName ?? m.employee.fullLegalName}</td>
                      <td className="px-4 py-3 text-slate-600">{t(`movementType.${m.movementType}`)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                          {t(`movementStatus.${m.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">{t("recruitment.navLabel")}</h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                    <td className="px-4 py-3 text-slate-600">{r.job?.jobTitle ?? "—"}</td>
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

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">{t("movement.navLabel")}</h2>
        {pendingMovements.length === 0 ? (
          <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("movement.requestNumber")}</th>
                  <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                  <th className="px-4 py-3 font-medium">{t("movement.movementType")}</th>
                  <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
                </tr>
              </thead>
              <tbody>
                {pendingMovements.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/movements/${m.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        {m.requestNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.employee.preferredName ?? m.employee.fullLegalName}</td>
                    <td className="px-4 py-3 text-slate-600">{t(`movementType.${m.movementType}`)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        {t(`movementStatus.${m.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

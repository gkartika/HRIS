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
  const employeeId = session.user.employeeId ?? "__none__";

  // Shared Evaluation (DM-26/27, WF-19, ACC-17): any employee-linked account
  // may be assigned as a P1/P2 evaluator on any evaluation source (Contract
  // Renewal, Perubahan Posisi or Manual HR) regardless of whether they hold
  // an HR Manager or Dept Head position, so this inbox's own gate below is
  // widened to also admit "I have a pending evaluation assigned to me" —
  // otherwise a plain evaluator would have no notification surface at all
  // (this app has no email channel; see DSH-10).
  const pendingOwnEvaluations = await prisma.evaluation.findMany({
    where: {
      status: "RELEASED",
      OR: [
        { p1EmployeeId: employeeId, p1SubmittedAt: null },
        { p2EmployeeId: employeeId, p2SubmittedAt: null },
      ],
    },
    include: { employee: true },
    orderBy: { releasedAt: "asc" },
  });

  if (hrManagerPositions.length === 0 && deptHeadDepartmentIds.length === 0 && pendingOwnEvaluations.length === 0) {
    return <p className="text-sm text-rose-600">{t("hrManagerUi.notHrManager")}</p>;
  }

  const [
    pendingRequests,
    pendingMovements,
    pendingDeptHeadRequests,
    pendingDeptHeadMovements,
    pendingDeptHeadRenewals,
    pendingHrManagerRenewals,
    pendingHrManagerOffboarding,
  ] = await Promise.all([
    // HR-Manager-only queues (WF-15: only the active HR Manager Position may
    // approve/reject/return) — must not be fetched at all for a viewer who
    // isn't currently an HR Manager, since this page is now also reachable
    // by a plain Dept Head or renewal evaluator with neither authority.
    hrManagerPositions.length > 0
      ? prisma.recruitmentRequest.findMany({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
          include: { department: true, job: true },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    hrManagerPositions.length > 0
      ? prisma.movementRequest.findMany({
          where: { status: "SUBMITTED" },
          include: { employee: true, currentPosition: { include: { job: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
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
    // Dept Head's own renewal recommendation queue: linked Evaluation must be
    // Completed (WF-17/ACC-16), scoped to this viewer's department(s) the
    // same way the Movement dept-head queue above is (currentPositionId
    // isn't on ContractRenewalCase directly — derived from
    // snapshotPositionId's orgUnit, itself or its Section-tier parent).
    deptHeadDepartmentIds.length > 0
      ? prisma.contractRenewalCase.findMany({
          where: {
            status: "EVALUATION_SENT",
            evaluation: { status: "COMPLETED" },
            snapshotPosition: {
              orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
            },
          },
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    // HR Manager's combined-decision queue (ACC-16/DEC-019).
    hrManagerPositions.length > 0
      ? prisma.contractRenewalCase.findMany({
          where: { status: "PENDING_HR_MANAGER" },
          include: { employee: true },
          orderBy: { deptHeadRecommendedAt: "asc" },
        })
      : Promise.resolve([]),
    // LIF-06: HR Manager's offboarding decision queue.
    hrManagerPositions.length > 0
      ? prisma.offboardingCase.findMany({
          where: { status: "PENDING_HR_MANAGER" },
          include: { employee: true },
          orderBy: { reportedAt: "asc" },
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

      {hrManagerPositions.length > 0 && (
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
      )}

      {hrManagerPositions.length > 0 && (
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
      )}

      {pendingOwnEvaluations.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">{t("evaluation.navLabel")} — {t("evaluation.p1Label")}/{t("evaluation.p2Label")}</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("evaluation.evaluationNumber")}</th>
                  <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                  <th className="px-4 py-3 font-medium">{t("evaluation.dueDate")}</th>
                </tr>
              </thead>
              <tbody>
                {pendingOwnEvaluations.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/evaluations/${e.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        {e.evaluationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.employee.preferredName ?? e.employee.fullLegalName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.evaluationDueDate ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(e.evaluationDueDate) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deptHeadDepartmentIds.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">
            {t("recruitment.deptHeadApprovalSectionTitle")} — {t("contractRenewal.navLabel")}
          </h2>
          {pendingDeptHeadRenewals.length === 0 ? (
            <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("contractRenewal.caseNumber")}</th>
                    <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDeptHeadRenewals.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <Link href={`/contracts/${c.currentContractId}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.employee.preferredName ?? c.employee.fullLegalName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hrManagerPositions.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">{t("contractRenewal.navLabel")}</h2>
          {pendingHrManagerRenewals.length === 0 ? (
            <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("contractRenewal.caseNumber")}</th>
                    <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingHrManagerRenewals.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <Link href={`/contracts/${c.currentContractId}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.employee.preferredName ?? c.employee.fullLegalName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hrManagerPositions.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">{t("offboarding.navLabel")}</h2>
          {pendingHrManagerOffboarding.length === 0 ? (
            <p className="text-sm text-slate-400">{t("hrManagerUi.approvalInboxEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("offboarding.caseNumber")}</th>
                    <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                    <th className="px-4 py-3 font-medium">{t("offboarding.reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingHrManagerOffboarding.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <Link href={`/offboarding/${c.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.employee.preferredName ?? c.employee.fullLegalName}</td>
                      <td className="px-4 py-3 text-slate-600">{t(`offboardingReason.${c.reason}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EmployeeAssignmentHistory } from "@/components/employee-profile-view";
import { AssignmentManagementPanel } from "./assignment-panel";
import { TaskForcePanel } from "./task-force-panel";

const SECTION_DIVIDERS =
  "[&>*:not(:first-child)]:mt-6 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-slate-100 [&>*:not(:first-child)]:pt-6";

// Split out of page.tsx and wrapped in <Suspense> there: the position list
// (every non-archived Position, for 3 rarely-opened forms), task force
// membership, and contracts are each their own query chain that the common
// "just checking Profil" page view never needed to wait on.
export async function PenempatanTabContent({
  employeeId,
  currentOrgUnitId,
  currentPositionId,
  currentReportsToPositionId,
  reportsTo,
  canManage,
  canSeeTaskForce,
  canManageTaskForce,
  canViewContracts,
  canCreateContract,
}: {
  employeeId: string;
  currentOrgUnitId: string | null;
  currentPositionId: string | null;
  currentReportsToPositionId: string | null;
  reportsTo: { label: string; holderName: string | null } | null;
  canManage: boolean;
  canSeeTaskForce: boolean;
  canManageTaskForce: boolean;
  canViewContracts: boolean;
  canCreateContract: boolean;
}) {
  async function loadTaskForce() {
    if (!canSeeTaskForce) return { memberships: [], names: [] };
    const [memberships, names] = await Promise.all([
      prisma.taskForceMembership.findMany({ where: { employeeId }, orderBy: { startDate: "desc" } }),
      canManageTaskForce
        ? prisma.taskForceMembership.findMany({ distinct: ["name"], select: { name: true }, orderBy: { name: "asc" } })
        : Promise.resolve([]),
    ]);
    return { memberships, names };
  }

  const [assignments, positions, { memberships: taskForceMemberships, names: taskForceNameRows }, contracts] =
    await Promise.all([
      prisma.assignment.findMany({
        where: { employeeId },
        include: { position: { include: { job: true, orgUnit: true } } },
        orderBy: { effectiveFrom: "desc" },
      }),
      canManage
        ? prisma.position.findMany({
            where: { archived: false },
            include: { job: true, orgUnit: true },
            orderBy: { positionCode: "asc" },
          })
        : Promise.resolve([]),
      loadTaskForce(),
      canViewContracts
        ? prisma.contract.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } })
        : Promise.resolve([]),
    ]);

  // Extra (Additional/Temporary) assignments must stay within the employee's
  // own department — cross-department "extra" seats belong to a real Mutasi
  // via "Pindahkan ke Posisi Baru" instead, per direct user request.
  const extraAssignmentPositions = currentOrgUnitId
    ? positions.filter((p) => p.orgUnitId === currentOrgUnitId)
    : [];
  const activeNonPrimaryAssignments = assignments
    .filter((a) => a.status === "ACTIVE" && a.assignmentType !== "PRIMARY")
    .map((a) => ({ id: a.id, positionCode: a.position.positionCode, assignmentType: a.assignmentType }));
  const activeTaskForceMemberships = taskForceMemberships
    .filter((m) => !m.endDate)
    .map((m) => ({
      id: m.id,
      name: m.name,
      roleLabel: m.roleLabel,
      startDate: m.startDate.toISOString().slice(0, 10),
      endDate: null,
    }));
  const endedTaskForceMemberships = taskForceMemberships
    .filter((m) => !!m.endDate)
    .map((m) => ({
      id: m.id,
      name: m.name,
      roleLabel: m.roleLabel,
      startDate: m.startDate.toISOString().slice(0, 10),
      endDate: m.endDate!.toISOString().slice(0, 10),
    }));
  const taskForceNames = taskForceNameRows.map((r) => r.name);

  return (
    <div className={SECTION_DIVIDERS}>
      <EmployeeAssignmentHistory assignments={assignments} reportsTo={reportsTo} />
      {canManage && (
        <AssignmentManagementPanel
          employeeId={employeeId}
          positions={positions}
          extraAssignmentPositions={extraAssignmentPositions}
          activeNonPrimaryAssignments={activeNonPrimaryAssignments}
          hasCurrentPosition={!!currentPositionId}
          currentReportsToPositionId={currentReportsToPositionId}
        />
      )}
      {canSeeTaskForce && (
        <TaskForcePanel
          employeeId={employeeId}
          canManage={canManageTaskForce}
          active={activeTaskForceMemberships}
          ended={endedTaskForceMemberships}
          existingNames={taskForceNames}
        />
      )}
      {canViewContracts && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900">{t("contract.listTitle")}</h2>
            {canCreateContract && (
              <Link
                href={`/contracts/new?employeeId=${employeeId}`}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                {t("contract.newContract")}
              </Link>
            )}
          </div>
          {contracts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">{t("contract.emptyState")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {contracts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-indigo-600">{c.contractNumber}</span>
                  <span className="text-xs text-slate-500">{t(`contractStatus.${c.status}`)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canListEmployees,
  projectEmployee,
  isHrAdmin,
  isTrainingAdmin,
  canManageAssignments,
  canViewEmployeeDocument,
  canUploadEmployeeDocument,
  canSubmitMovementRequest,
  canViewContract,
  canManageContracts,
  canReportResignation,
  canSubmitShiftAssignment,
  canManageAccountHold,
  canManageAttendanceAssignment,
  canViewAttendance,
  canManageTaskForceMembership,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { EmployeeProfileView } from "@/components/employee-profile-view";
import { AssignmentManagementPanel } from "./assignment-panel";
import { IdentityDocumentsPanel } from "./identity-documents-panel";
import { AccountHoldPanel } from "./account-panel";
import { AttendanceAssignmentPanel } from "./attendance-panel";
import { TaskForcePanel } from "./task-force-panel";
import { isEmployeeProfileIncomplete, missingFieldLabels } from "@/lib/employee-completeness";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const isSelf = session.user.employeeId === id;

  if (!isSelf && !canListEmployees(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      currentPosition: {
        include: {
          job: true,
          orgUnit: true,
          reportsToPosition: {
            include: {
              job: true,
              currentHolders: { where: { activeFlag: true }, select: { fullLegalName: true } },
            },
          },
        },
      },
      assignments: {
        include: { position: { include: { job: true, orgUnit: true } } },
        orderBy: { effectiveFrom: "desc" },
      },
      files: true,
      educationLevel: true,
      ptkpStatus: true,
      ktpFile: true,
      kkFile: true,
      account: { select: { accountStatus: true, usernameOrEmail: true } },
    },
  });
  if (!employee) notFound();

  await logAudit({
    actorAccountId: session.user.id,
    action: "VIEW",
    datasetName: "Employee",
    recordId: employee.id,
    reason: isSelf ? "Viewed own profile" : "Viewed employee detail",
  });

  const projected = projectEmployee(employee, session);
  // Documents carry their own sensitivity (many are Highly Restricted, e.g.
  // contracts) independent of which Employee fields a role can see — only the
  // owner or HR Admin should even know a given file exists (matches the
  // permission check in /api/files/[id]). KTP/KK are excluded from the
  // generic list since they get their own dedicated panel below.
  const canViewDocs = canViewEmployeeDocument(session, employee.id);
  const visibleFiles = canViewDocs
    ? employee.files.filter((f) => f.category !== "KTP" && f.category !== "KK")
    : [];
  const canEdit = isSelf || isHrAdmin(session);
  const canManage = canManageAssignments(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const canHoldAccount = canManageAccountHold(session, hrManagerPositions.map((p) => p.positionId));
  const canUploadDocs = canUploadEmployeeDocument(session);
  const isLevel3InDepartment = await isLevel3ForEmployeeDepartment(session.user.employeeId, employee.id);
  const canSubmitMovement =
    !!employee.currentPositionId && canSubmitMovementRequest(session, isLevel3InDepartment);
  const isEmployeesManager = await isDirectManagerOfEmployee(session.user.employeeId, employee.id);
  const canReportThisResignation = canReportResignation(session, isEmployeesManager);
  const canSetShift = !!employee.currentPositionId && canSubmitShiftAssignment(session, isLevel3InDepartment);
  const canManageAttendance = canManageAttendanceAssignment(session);
  const canSeeAttendance = canViewAttendance(session, employee.id, isLevel3InDepartment);
  const [geofences, currentAttendanceAssignment] = canSeeAttendance
    ? await Promise.all([
        canManageAttendance
          ? prisma.attendanceGeofence.findMany({ where: { activeFlag: true }, orderBy: { siteName: "asc" } })
          : Promise.resolve([]),
        prisma.attendanceAssignment.findFirst({
          where: { employeeId: employee.id, effectiveTo: null },
          include: { geofence: true },
          orderBy: { effectiveFrom: "desc" },
        }),
      ])
    : [[], null];

  const canManageTaskForce = canManageTaskForceMembership(session);
  const canSeeTaskForce = isSelf || isHrAdmin(session);
  const [taskForceMemberships, taskForceNameRows] = canSeeTaskForce
    ? await Promise.all([
        prisma.taskForceMembership.findMany({
          where: { employeeId: employee.id },
          orderBy: { startDate: "desc" },
        }),
        canManageTaskForce
          ? prisma.taskForceMembership.findMany({ distinct: ["name"], select: { name: true }, orderBy: { name: "asc" } })
          : Promise.resolve([]),
      ])
    : [[], []];
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

  // noKk/namaIbuKandung/ptkpStatusCode are already stripped by projectEmployee
  // for roles that shouldn't see them. educationLevel isn't in that restricted
  // set (training-relevant), but still shouldn't reach GA Admin (ACC-04 is
  // limited to number/name/org placement/work location/assets).
  const canSeeEducation = isSelf || isHrAdmin(session) || isTrainingAdmin(session);
  const educationLevelLabel = canSeeEducation ? employee.educationLevel?.label ?? null : undefined;
  const ptkpLabel = canViewDocs
    ? employee.ptkpStatus
      ? `${employee.ptkpStatus.code} — ${employee.ptkpStatus.label}`
      : null
    : undefined;

  const incomplete = isEmployeeProfileIncomplete(employee);
  const missing = incomplete ? missingFieldLabels(employee) : [];

  const positions = canManage
    ? await prisma.position.findMany({
        include: { job: true, orgUnit: true },
        orderBy: { positionCode: "asc" },
      })
    : [];
  // Extra (Additional/Temporary) assignments must stay within the employee's
  // own department — cross-department "extra" seats belong to a real Mutasi
  // via "Pindahkan ke Posisi Baru" instead, per direct user request.
  const extraAssignmentPositions = employee.currentPosition
    ? positions.filter((p) => p.orgUnitId === employee.currentPosition!.orgUnitId)
    : [];
  const reportsToHolder = employee.currentPosition?.reportsToPosition?.currentHolders[0];
  const reportsTo = employee.currentPosition?.reportsToPosition
    ? {
        label: `${employee.currentPosition.reportsToPosition.jobLevel} ${employee.currentPosition.reportsToPosition.job.jobTitle}`,
        holderName: reportsToHolder ? reportsToHolder.fullLegalName : null,
      }
    : null;
  const activeNonPrimaryAssignments = employee.assignments
    .filter((a) => a.status === "ACTIVE" && a.assignmentType !== "PRIMARY")
    .map((a) => ({
      id: a.id,
      positionCode: a.position.positionCode,
      assignmentType: a.assignmentType,
    }));

  const canViewContracts = canViewContract(session, employee.id);
  const canCreateContract = canManageContracts(session);
  const contracts = canViewContracts
    ? await prisma.contract.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } })
    : [];

  return (
    <div className="space-y-6">
      {(canEdit || canSubmitMovement || canReportThisResignation || canSetShift) && (
        <div className="flex justify-end gap-4">
          {canSubmitMovement && (
            <Link
              href={`/movements/new?employeeId=${employee.id}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              {t("movement.newRequest")}
            </Link>
          )}
          {canSetShift && (
            <Link href="/shift-assignments" className="text-sm text-indigo-600 hover:underline">
              {t("shiftAssignment.navLabel")}
            </Link>
          )}
          {canReportThisResignation && (
            <Link
              href={`/offboarding/new?employeeId=${employee.id}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              {t("offboarding.reportButton")}
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/employees/${employee.id}/edit`}
              className="text-sm text-indigo-600 hover:underline"
            >
              {t("common.edit")}
            </Link>
          )}
        </div>
      )}
      {incomplete && (canEdit || canManage) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Data belum lengkap — lengkapi: {missing.join(", ")}.
        </div>
      )}
      <EmployeeProfileView
        employee={projected}
        assignments={employee.assignments}
        files={visibleFiles}
        educationLevelLabel={educationLevelLabel}
        ptkpLabel={ptkpLabel}
        reportsTo={reportsTo}
      />
      {canHoldAccount && employee.account && (
        <AccountHoldPanel
          employeeId={employee.id}
          accountStatus={employee.account.accountStatus}
          usernameOrEmail={employee.account.usernameOrEmail}
        />
      )}
      {canSeeAttendance && (
        <AttendanceAssignmentPanel
          employeeId={employee.id}
          canManage={canManageAttendance}
          current={
            currentAttendanceAssignment
              ? {
                  method: currentAttendanceAssignment.method,
                  geofenceName: currentAttendanceAssignment.geofence?.siteName ?? null,
                  fingerprintDeviceUserId: currentAttendanceAssignment.fingerprintDeviceUserId,
                  effectiveFrom: currentAttendanceAssignment.effectiveFrom.toISOString().slice(0, 10),
                }
              : null
          }
          geofences={geofences}
        />
      )}
      {canSeeTaskForce && (
        <TaskForcePanel
          employeeId={employee.id}
          canManage={canManageTaskForce}
          active={activeTaskForceMemberships}
          ended={endedTaskForceMemberships}
          existingNames={taskForceNames}
        />
      )}
      {canViewDocs && (
        <IdentityDocumentsPanel
          employeeId={employee.id}
          ktpFile={employee.ktpFile}
          kkFile={employee.kkFile}
          canUpload={canUploadDocs}
        />
      )}
      {canManage && (
        <AssignmentManagementPanel
          employeeId={employee.id}
          positions={positions}
          extraAssignmentPositions={extraAssignmentPositions}
          activeNonPrimaryAssignments={activeNonPrimaryAssignments}
          hasCurrentPosition={!!employee.currentPositionId}
          currentReportsToPositionId={employee.currentPosition?.reportsToPositionId ?? null}
        />
      )}
      {canViewContracts && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">{t("contract.listTitle")}</p>
            {canCreateContract && (
              <Link
                href={`/contracts/new?employeeId=${employee.id}`}
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

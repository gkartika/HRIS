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
  canViewBpjsCard,
  canSubmitMovementRequest,
  canViewContract,
  canManageContracts,
  canStartOffboarding,
  canSubmitShiftAssignment,
  canManageAccountHold,
  canManageAccountAccess,
  canManageAttendanceAssignment,
  canViewAttendance,
  canManageTaskForceMembership,
  canManageAttendanceMasterData,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { deriveEmployeeLifecycleStatus } from "@/lib/employee-lifecycle";
import { EmployeeProfileFields, EmployeeAssignmentHistory } from "@/components/employee-profile-view";
import { EmployeeHeader } from "./employee-header";
import { EmployeeTabs } from "./employee-tabs";
import { AssignmentManagementPanel } from "./assignment-panel";
import { BpjsCardsPanel } from "./bpjs-cards-panel";
import { AccountHoldPanel } from "./account-panel";
import { AccountAccessPanel } from "./account-access-panel";
import { AttendanceAssignmentPanel } from "./attendance-panel";
import { AbsenceQuotaPanel } from "./absence-quota-panel";
import { TaskForcePanel } from "./task-force-panel";
import { usedDaysThisYearByType } from "@/lib/absence-quota";
import { isEmployeeProfileIncomplete, missingFieldLabels } from "@/lib/employee-completeness";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";

const LIFECYCLE_BADGE_TONE: Record<string, string> = {
  AKAN_MASUK: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  OUT: "bg-rose-50 text-rose-700",
};

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  INVITED: "Diundang",
  ACTIVE: "Aktif",
  LOCKED: "Terkunci",
  DISABLED: "Ditahan",
};

// Sections within a tab are separated by a top border/padding applied to
// every child but the first, so conditionally-rendered sections (most of
// them, depending on viewer permissions) still line up consistently without
// each one needing to know whether it's first.
const SECTION_DIVIDERS = "[&>*:not(:first-child)]:mt-6 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-slate-100 [&>*:not(:first-child)]:pt-6";

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
      bpjsTkFile: true,
      bpjsKesehatanFile: true,
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
  // permission check in /api/files/[id]). BPJS cards are excluded from the
  // generic list since they get their own dedicated panel below, with a
  // wider view audience (canViewBpjs, not canViewDocs).
  const canViewDocs = canViewEmployeeDocument(session, employee.id);
  const visibleFiles = canViewDocs
    ? employee.files.filter((f) => f.category !== "BPJS_TK" && f.category !== "BPJS_KESEHATAN")
    : [];
  const canViewBpjs = canViewBpjsCard(session, employee.id);
  const canEdit = isSelf || isHrAdmin(session);
  const canManage = canManageAssignments(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const canHoldAccount = canManageAccountHold(session, hrManagerPositions.map((p) => p.positionId));
  const canUploadDocs = canUploadEmployeeDocument(session);
  const isLevel3InDepartment = await isLevel3ForEmployeeDepartment(session.user.employeeId, employee.id);
  const canSubmitMovement =
    !!employee.currentPositionId && canSubmitMovementRequest(session, isLevel3InDepartment);
  const canReportThisResignation = canStartOffboarding(session);
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

  const canManageAbsenceQuota = canManageAttendanceMasterData(session);
  const absenceQuotaRows = canManageAbsenceQuota
    ? await (async () => {
        // 4 queries total regardless of how many Absence types exist — was
        // previously 3 + 2 per type (usedDaysThisYear looped per type).
        const [types, entitlements, overrides, usedByType] = await Promise.all([
          prisma.absenceTypeConfig.findMany({ where: { activeFlag: true }, orderBy: { sortOrder: "asc" } }),
          prisma.absenceEntitlementConfig.findMany(),
          prisma.absenceQuotaOverride.findMany({ where: { employeeId: employee.id } }),
          usedDaysThisYearByType(employee.id),
        ]);
        const defaultByCode = new Map(entitlements.map((e) => [e.absenceTypeCode, e.annualDays]));
        const overrideByCode = new Map(overrides.map((o) => [o.absenceTypeCode, o.annualDays]));
        return types.map((tp) => ({
          code: tp.code,
          label: tp.label,
          defaultAnnualDays: defaultByCode.has(tp.code) ? defaultByCode.get(tp.code)! : null,
          overrideAnnualDays: overrideByCode.get(tp.code) ?? null,
          usedDaysThisYear: usedByType.get(tp.code) ?? 0,
        }));
      })()
    : [];

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
        where: { archived: false },
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

  const lifecycleStatus =
    employee.activeFlag !== undefined && employee.hireDate
      ? deriveEmployeeLifecycleStatus(employee.activeFlag, new Date(employee.hireDate))
      : null;

  const badges = (
    <>
      {lifecycleStatus && (
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${LIFECYCLE_BADGE_TONE[lifecycleStatus]}`}>
          {t(`employeeLifecycleStatus.${lifecycleStatus}`)}
        </span>
      )}
      {employee.employmentStatus && (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {t(`employmentStatus.${employee.employmentStatus}`)}
        </span>
      )}
    </>
  );

  const holdPanel =
    canHoldAccount && employee.account ? (
      <AccountHoldPanel
        employeeId={employee.id}
        accountStatus={employee.account.accountStatus}
        usernameOrEmail={employee.account.usernameOrEmail}
      />
    ) : null;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Karyawan", href: "/employees" }, { label: "Detail Karyawan" }]} />

      <EmployeeHeader
        name={employee.fullLegalName}
        employeeNumber={employee.employeeNumber}
        badges={badges}
        movementHref={canSubmitMovement ? `/movements/new?employeeId=${employee.id}` : null}
        shiftHref={canSetShift ? "/shift-assignments" : null}
        offboardingHref={canReportThisResignation ? `/offboarding/new?employeeId=${employee.id}` : null}
        editHref={canEdit ? `/employees/${employee.id}/edit` : null}
        holdPanel={holdPanel}
      />

      {incomplete && (canEdit || canManage) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Data belum lengkap — lengkapi: {missing.join(", ")}.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Posisi Saat Ini</p>
          <p className="mt-0.5 font-medium text-slate-900">
            {employee.currentPosition
              ? `${employee.currentPosition.jobLevel} ${employee.currentPosition.job.jobTitle}`
              : t("employee.noPosition")}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{t("employee.department")}</p>
          <p className="mt-0.5 font-medium text-slate-900">{employee.currentPosition?.orgUnit.unitName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{t("assignmentUi.reportsTo")}</p>
          <p className="mt-0.5 font-medium text-slate-900">{reportsTo ? reportsTo.label : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Akun Masuk</p>
          <p className="mt-0.5 font-medium text-slate-900">
            {employee.account ? ACCOUNT_STATUS_LABEL[employee.account.accountStatus] ?? employee.account.accountStatus : "Belum ada akun"}
          </p>
        </div>
      </div>

      <EmployeeTabs
        profil={
          <div className={SECTION_DIVIDERS}>
            <EmployeeProfileFields employee={projected} educationLevelLabel={educationLevelLabel} ptkpLabel={ptkpLabel} />
            {(canViewBpjs || visibleFiles.length > 0) && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Dokumen</h3>
                {canViewBpjs && (
                  <BpjsCardsPanel
                    employeeId={employee.id}
                    bpjsTkFile={employee.bpjsTkFile}
                    bpjsKesehatanFile={employee.bpjsKesehatanFile}
                    canUpload={canUploadDocs}
                  />
                )}
                {visibleFiles.length > 0 && (
                  <div className={canViewBpjs ? "mt-4" : ""}>
                    <div className="space-y-2">
                      {visibleFiles.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-sm text-indigo-600 hover:bg-slate-50"
                        >
                          <span>{f.originalFileName}</span>
                          <span className="text-xs text-slate-400">{f.category}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        }
        penempatan={
          <div className={SECTION_DIVIDERS}>
            <EmployeeAssignmentHistory assignments={employee.assignments} reportsTo={reportsTo} />
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
            {canSeeTaskForce && (
              <TaskForcePanel
                employeeId={employee.id}
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
        }
        akun={
          <div className={SECTION_DIVIDERS}>
            {canManageAccountAccess(session) && (
              <AccountAccessPanel
                employeeId={employee.id}
                accountStatus={employee.account?.accountStatus ?? null}
                personalEmail={employee.personalEmail}
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
            {canManageAbsenceQuota && <AbsenceQuotaPanel employeeId={employee.id} rows={absenceQuotaRows} />}
          </div>
        }
      />
    </div>
  );
}

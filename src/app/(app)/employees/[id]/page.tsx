import { StatusChip } from "@/components/status-chip";
import { LIFECYCLE_STATUS_TONE } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { after } from "next/server";
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
import { isLevel3ForEmployeeDepartment, isMovementSubmitterForEmployeeDepartment } from "@/lib/level3-scope";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { deriveEmployeeLifecycleStatus } from "@/lib/employee-lifecycle";
import { EmployeeProfileFields } from "@/components/employee-profile-view";
import { EmployeeHeader } from "./employee-header";
import { EmployeeTabs, parseEmployeeTab } from "./employee-tabs";
import { BpjsCardsPanel } from "./bpjs-cards-panel";
import { AccountHoldPanel } from "./account-panel";
import { PenempatanTabContent } from "./penempatan-tab";
import { AkunTabContent } from "./akun-tab";
import { isEmployeeProfileIncomplete, missingFieldLabels } from "@/lib/employee-completeness";
import { Breadcrumbs } from "@/components/breadcrumbs";

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="h-4 w-1/3 rounded bg-slate-100" />
      <div className="h-16 rounded-lg bg-slate-50" />
      <div className="h-16 rounded-lg bg-slate-50" />
    </div>
  );
}

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const activeTab = parseEmployeeTab((await searchParams).tab);
  const session = await requireSession();
  const isSelf = session.user.employeeId === id;

  if (!isSelf && !canListEmployees(session)) {
    return <AccessDenied />;
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
      // Documents and BPJS cards only appear on the Profil tab.
      files: activeTab === "profil",
      educationLevel: true,
      ptkpStatus: true,
      bpjsTkFile: activeTab === "profil",
      bpjsKesehatanFile: activeTab === "profil",
      account: { select: { accountStatus: true, usernameOrEmail: true } },
    },
  });
  if (!employee) notFound();

  // The audit write does not hold up the page; it runs right after the response.
  const viewedAs = isSelf ? "Viewed own profile" : "Viewed employee detail";
  after(() =>
    logAudit({
      actorAccountId: session.user.id,
      action: "VIEW",
      datasetName: "Employee",
      recordId: employee.id,
      reason: viewedAs,
    })
  );

  const projected = projectEmployee(employee, session);
  // Documents carry their own sensitivity (many are Highly Restricted, e.g.
  // contracts) independent of which Employee fields a role can see — only the
  // owner or HR Admin should even know a given file exists (matches the
  // permission check in /api/files/[id]). BPJS cards are excluded from the
  // generic list since they get their own dedicated panel below, with a
  // wider view audience (canViewBpjs, not canViewDocs).
  const canViewDocs = canViewEmployeeDocument(session, employee.id);
  const visibleFiles = canViewDocs
    ? (employee.files ?? []).filter((f) => f.category !== "BPJS_TK" && f.category !== "BPJS_KESEHATAN")
    : [];
  const canViewBpjs = canViewBpjsCard(session, employee.id);
  const canEdit = isSelf || isHrAdmin(session);
  const canManage = canManageAssignments(session);
  const [hrManagerPositions, isLevel3InDepartment, isMovementSubmitter] = await Promise.all([
    getActiveHrManagerPositions(session.user.employeeId),
    isLevel3ForEmployeeDepartment(session.user.employeeId, employee.id, employee.currentPosition?.orgUnitId ?? null),
    isMovementSubmitterForEmployeeDepartment(session.user.employeeId, employee.id, employee.currentPosition?.orgUnitId ?? null),
  ]);
  const canHoldAccount = canManageAccountHold(session, hrManagerPositions.map((p) => p.positionId));
  const canUploadDocs = canUploadEmployeeDocument(session);
  const canSubmitMovement =
    !!employee.currentPositionId && canSubmitMovementRequest(session, isMovementSubmitter);
  const canReportThisResignation = canStartOffboarding(session);
  const canSetShift = !!employee.currentPositionId && canSubmitShiftAssignment(session, isLevel3InDepartment);
  const canManageAttendance = canManageAttendanceAssignment(session);
  const canSeeAttendance = canViewAttendance(session, employee.id, isLevel3InDepartment);
  const canManageAbsenceQuota = canManageAttendanceMasterData(session);
  const canManageTaskForce = canManageTaskForceMembership(session);
  const canSeeTaskForce = isSelf || isHrAdmin(session);

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

  const reportsToHolder = employee.currentPosition?.reportsToPosition?.currentHolders[0];
  const reportsTo = employee.currentPosition?.reportsToPosition
    ? {
        label: `${employee.currentPosition.reportsToPosition.jobLevel} ${employee.currentPosition.reportsToPosition.job.jobTitle}`,
        holderName: reportsToHolder ? reportsToHolder.fullLegalName : null,
      }
    : null;

  const canViewContracts = canViewContract(session, employee.id);
  const canCreateContract = canManageContracts(session);

  const lifecycleStatus =
    employee.activeFlag !== undefined && employee.hireDate
      ? deriveEmployeeLifecycleStatus(employee.activeFlag, new Date(employee.hireDate))
      : null;

  const badges = (
    <>
      {lifecycleStatus && (
        <StatusChip tone={LIFECYCLE_STATUS_TONE[lifecycleStatus]}>
          {t(`employeeLifecycleStatus.${lifecycleStatus}`)}
        </StatusChip>
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

      <EmployeeTabs active={activeTab}>
        {activeTab === "profil" && (
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
        )}
        {activeTab === "penempatan" && (
          <Suspense fallback={<TabSkeleton />}>
            <PenempatanTabContent
              employeeId={employee.id}
              currentOrgUnitId={employee.currentPosition?.orgUnitId ?? null}
              currentPositionId={employee.currentPositionId}
              currentReportsToPositionId={employee.currentPosition?.reportsToPositionId ?? null}
              reportsTo={reportsTo}
              canManage={canManage}
              canSeeTaskForce={canSeeTaskForce}
              canManageTaskForce={canManageTaskForce}
              canViewContracts={canViewContracts}
              canCreateContract={canCreateContract}
            />
          </Suspense>
        )}
        {activeTab === "akun" && (
          <Suspense fallback={<TabSkeleton />}>
            <AkunTabContent
              employeeId={employee.id}
              accountStatus={employee.account?.accountStatus ?? null}
              personalEmail={employee.personalEmail}
              canManageAccountAccess={canManageAccountAccess(session)}
              canSeeAttendance={canSeeAttendance}
              canManageAttendance={canManageAttendance}
              canManageAbsenceQuota={canManageAbsenceQuota}
            />
          </Suspense>
        )}
      </EmployeeTabs>
    </div>
  );
}

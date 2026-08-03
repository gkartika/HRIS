import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canApproveMovementRequest,
  canApproveMovementRequestAsDeptHead,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  isHrAdmin,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
  isPerubahanPosisiType,
} from "@/lib/movement";
import {
  MovementDecisionButtons,
  DeptHeadDecisionButtons,
  ExecuteMovementButton,
  CancelMovementForm,
  MovementHrFieldsForm,
} from "./decision-forms";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.movementRequest.findUnique({
    where: { id },
    include: {
      employee: true,
      currentPosition: { include: { job: true, orgUnit: true } },
      proposedPosition: { include: { job: true, orgUnit: true } },
      requesterEmployee: true,
      requesterPosition: { include: { job: true } },
      submittedByAccount: true,
      deptHeadDecisionByAccount: true,
      deptHeadDecisionPosition: { include: { job: true } },
      decisionByAccount: true,
      decisionPosition: { include: { job: true } },
      implementedByAccount: true,
      implementedAssignment: true,
      cancelledByAccount: true,
      cancelledByEmployee: true,
    },
  });
  if (!request) notFound();

  const isOwnRequest =
    request.requesterEmployeeId === session.user.employeeId || request.employeeId === session.user.employeeId;
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const activeHrManagerPositionIds = hrManagerPositions.map((p) => p.positionId);
  const isHrManagerNow = activeHrManagerPositionIds.length > 0;
  const departmentId = await resolveDepartmentId(request.currentPosition.orgUnitId);
  const deptHeadPositions = departmentId
    ? await getActiveDeptHeadPositions(session.user.employeeId, departmentId)
    : [];
  const activeDeptHeadPositionIds = deptHeadPositions.map((p) => p.positionId);
  const isDeptHeadNow = activeDeptHeadPositionIds.length > 0;
  const isHrAdminUser = isHrAdmin(session);

  if (!isHrAdminUser && !isHrManagerNow && !isDeptHeadNow && !isOwnRequest) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  // Confidentiality (Perubahan Posisi refactor): HR attendance data,
  // evaluation reference and confidential HR notes are visible only to
  // HR Admin, HR Manager, or the Department Head 3B deciding this specific
  // request — never to the Level-3 requester or the affected employee.
  const canSeeConfidential = isHrAdminUser || isHrManagerNow || isDeptHeadNow;
  const isLegacyType = !isPerubahanPosisiType(request.movementType);

  const canDecide =
    !isLegacyType &&
    canApproveMovementRequest(activeHrManagerPositionIds) &&
    canDecideMovementRequestStatus(request.status);
  const canDecideAsDeptHead =
    !isLegacyType &&
    canApproveMovementRequestAsDeptHead(activeDeptHeadPositionIds) &&
    request.status === "PENDING_DEPT_HEAD";
  const canExecute =
    !isLegacyType && canExecuteMovementRequest(session) && canExecuteMovementRequestStatus(request.status);
  const canCancel =
    !isLegacyType &&
    canCancelMovementRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds) &&
    canCancelMovementRequestStatus(request.status);
  const canEditHrFields = !isLegacyType && isHrAdminUser && request.status !== "IMPLEMENTED" && request.status !== "CANCELLED";

  // A return/reject reason is meant for the requester to act on — always
  // shown regardless of viewer. An approval's own note may carry internal
  // remarks, so it's only shown to privileged viewers.
  const showHrDecisionNote = canSeeConfidential || request.status === "REJECTED" || request.status === "RETURNED";
  const showDeptHeadDecisionNote =
    canSeeConfidential || request.status === "REJECTED" || request.status === "RETURNED";

  return (
    <div className="space-y-6">
      {isLegacyType && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t("movement.legacyTypeNotice")}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{request.requestNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {request.employee.preferredName ?? request.employee.fullLegalName} ({request.employee.employeeNumber})
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {t(`movementStatus.${request.status}`)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">{t("movement.movementType")}</p>
            <p className="text-sm text-slate-900">{t(`movementType.${request.movementType}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("movement.currentPosition")}</p>
            <p className="text-sm text-slate-900">
              {request.currentPosition.job.jobTitle} / {request.currentPosition.job.jobLevel} (
              {request.currentPosition.positionCode})
            </p>
            <p className="text-xs text-slate-400">{request.currentPosition.orgUnit.unitName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("movement.proposedPosition")}</p>
            <p className="text-sm text-slate-900">
              {request.proposedPosition.job.jobTitle} / {request.proposedPosition.job.jobLevel} (
              {request.proposedPosition.positionCode})
            </p>
            <p className="text-xs text-slate-400">{request.proposedPosition.orgUnit.unitName}</p>
          </div>
          {request.proposedEmploymentStatus && (
            <div>
              <p className="text-xs text-slate-500">{t("movement.proposedEmploymentStatus")}</p>
              <p className="text-sm text-slate-900">{t(`employmentStatus.${request.proposedEmploymentStatus}`)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">{t("movement.proposedEffectiveDate")}</p>
            <p className="text-sm text-slate-900">{formatDate(request.proposedEffectiveDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.submittedBy")}</p>
            <p className="text-sm text-slate-900">
              {request.requesterEmployee.preferredName ?? request.requesterEmployee.fullLegalName}
              {request.requesterPosition ? ` (${request.requesterPosition.job.jobTitle})` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500">{t("movement.requestReason")}</p>
          <p className="text-sm text-slate-900">{request.requestReason}</p>
        </div>

        {canSeeConfidential && (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-medium text-slate-600">{t("movement.hrOnlySectionTitle")}</p>
            {canEditHrFields ? (
              <MovementHrFieldsForm
                requestId={request.id}
                initial={{
                  attendanceAlpha: request.attendanceAlpha,
                  attendanceSakit: request.attendanceSakit,
                  attendanceIjin: request.attendanceIjin,
                  attendanceIjinHalfDay: request.attendanceIjinHalfDay,
                  attendanceCuti: request.attendanceCuti,
                  performanceEvaluationRef: request.performanceEvaluationRef,
                  hrConfidentialNotes: request.hrConfidentialNotes,
                }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">{t("movement.attendanceTitle")}</p>
                  <p className="text-slate-900">
                    {t("movement.attendanceAlpha")} {request.attendanceAlpha ?? "—"} ·{" "}
                    {t("movement.attendanceSakit")} {request.attendanceSakit ?? "—"} ·{" "}
                    {t("movement.attendanceIjin")} {request.attendanceIjin ?? "—"} ·{" "}
                    {t("movement.attendanceIjinHalfDay")} {request.attendanceIjinHalfDay ?? "—"} ·{" "}
                    {t("movement.attendanceCuti")} {request.attendanceCuti ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("movement.performanceEvaluationRef")}</p>
                  <p className="text-slate-900">{request.performanceEvaluationRef ?? "—"}</p>
                </div>
                {request.hrConfidentialNotes && (
                  <div>
                    <p className="text-xs text-slate-500">{t("movement.hrConfidentialNotes")}</p>
                    <p className="text-slate-900">{request.hrConfidentialNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showDeptHeadDecisionNote && request.deptHeadDecisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">
              {t("recruitment.decisionNote")} ({t("recruitment.deptHeadApprovalSectionTitle")})
            </p>
            <p className="text-sm text-slate-900">{request.deptHeadDecisionNote}</p>
          </div>
        )}
        {showHrDecisionNote && request.decisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.decisionNote")}</p>
            <p className="text-sm text-slate-900">{request.decisionNote}</p>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          {t("recruitment.submittedBy")}: {request.submittedByAccount.usernameOrEmail} ({formatDate(request.submittedAt)})
          {request.deptHeadDecisionByAccount && (
            <>
              {" · "}
              {t("recruitment.deptHeadDecisionBy")}: {request.deptHeadDecisionByAccount.usernameOrEmail} (
              {formatDate(request.deptHeadDecisionAt)})
              {request.deptHeadDecisionPosition && (
                <>
                  {" — "}
                  {t("recruitment.deptHeadDecisionPosition")}: {request.deptHeadDecisionPosition.job.jobTitle} (
                  {request.deptHeadDecisionPosition.positionCode})
                </>
              )}
            </>
          )}
          {request.decisionByAccount && (
            <>
              {" · "}
              {t("recruitment.approvedBy")}: {request.decisionByAccount.usernameOrEmail} ({formatDate(request.decisionAt)})
              {request.decisionPosition && (
                <> — {t("recruitment.decisionPosition")}: {request.decisionPosition.job.jobTitle} ({request.decisionPosition.positionCode})</>
              )}
            </>
          )}
          {request.implementedByAccount && (
            <>
              {" · "}
              {t("movement.implementedBy")}: {request.implementedByAccount.usernameOrEmail} ({formatDate(request.implementedAt)})
            </>
          )}
          {request.status === "CANCELLED" && (
            <>
              {" · "}
              {t("recruitment.cancelledBy")}:{" "}
              {request.cancelledByEmployee?.preferredName ?? request.cancelledByEmployee?.fullLegalName ?? request.cancelledByAccount?.usernameOrEmail ?? "—"}
              {" "}({t(`cancellationAuthority.${request.cancellationAuthority}`)}, {formatDate(request.cancelledAt)})
              {request.cancellationReason && <> — {request.cancellationReason}</>}
            </>
          )}
        </p>
      </div>

      {canDecideAsDeptHead && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("recruitment.deptHeadApprovalSectionTitle")}</p>
          <DeptHeadDecisionButtons requestId={request.id} positions={deptHeadPositions} />
        </div>
      )}
      {canDecide && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <MovementDecisionButtons requestId={request.id} positions={hrManagerPositions} />
        </div>
      )}
      {canExecute && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("movement.executeButton")}</p>
          <ExecuteMovementButton requestId={request.id} />
        </div>
      )}
      {canCancel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("recruitment.cancelRequestButton")}</p>
          <CancelMovementForm requestId={request.id} />
        </div>
      )}
    </div>
  );
}

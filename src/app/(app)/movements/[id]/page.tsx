import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { formatDateLong, formatDateMedium } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import {
  canApproveMovementRequest,
  canApproveMovementRequestAsDeptHead,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  canManageRecruitment,
  isHrAdmin,
} from "@/lib/permissions";
import { MOVEMENT_ORIGIN_LABEL } from "@/lib/recruitment-source";
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
  isAddPositionType,
} from "@/lib/movement";
import { isEvaluationGateSatisfied } from "@/lib/evaluation";
import {
  MovementDecisionButtons,
  DeptHeadDecisionButtons,
  ExecuteMovementButton,
  ExecuteAddPositionForm,
  CancelMovementForm,
  MovementHrFieldsForm,
} from "./decision-forms";
import { EvaluationPanel } from "../../evaluations/evaluation-panel";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.movementRequest.findUnique({
    where: { id },
    include: {
      employee: true,
      currentPosition: { include: { job: true, orgUnit: true } },
      proposedPosition: { include: { job: true, orgUnit: true } },
      proposedJob: { select: { id: true, jobTitle: true } },
      proposedOrgUnit: { select: { id: true, unitName: true } },
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
      evaluation: { select: { status: true } },
      // where the move came from: the applicant's request, or the request a Mutasi fills
      recruitmentCandidate: { select: { request: { select: { id: true, requestNumber: true, job: { select: { jobTitle: true } } } } } },
      recruitmentRequest: { select: { id: true, requestNumber: true } },
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
    return <AccessDenied />;
  }

  // Confidentiality (Perubahan Posisi refactor): HR attendance data,
  // evaluation reference and confidential HR notes are visible only to
  // HR Admin, HR Manager, or the Department Head 3B deciding this specific
  // request — never to the Level-3 requester or the affected employee.
  const canSeeConfidential = isHrAdminUser || isHrManagerNow || isDeptHeadNow;
  const isLegacyType = !isPerubahanPosisiType(request.movementType);

  // WF-17/ACC-16: Dept Head and HR Manager completion is blocked until the
  // linked Evaluation (auto-created on submission for Promosi/Mutasi/Demosi)
  // reaches Completed — same gate the shared evaluations/actions.ts already
  // enforces server-side; mirrored here so the button doesn't appear only to
  // fail, matching the Contract Renewal detail page's pattern.
  const evaluationGateSatisfied = isEvaluationGateSatisfied(request.evaluation?.status ?? null);
  const canDecide =
    !isLegacyType &&
    canApproveMovementRequest(activeHrManagerPositionIds) &&
    canDecideMovementRequestStatus(request.status) &&
    evaluationGateSatisfied;
  const canDecideAsDeptHead =
    !isLegacyType &&
    canApproveMovementRequestAsDeptHead(activeDeptHeadPositionIds) &&
    request.status === "PENDING_DEPT_HEAD" &&
    evaluationGateSatisfied;
  const decisionBlockedByEvaluation =
    !isLegacyType &&
    !evaluationGateSatisfied &&
    (request.status === "PENDING_DEPT_HEAD" || request.status === "SUBMITTED") &&
    (canApproveMovementRequestAsDeptHead(activeDeptHeadPositionIds) || canApproveMovementRequest(activeHrManagerPositionIds));
  const canExecute =
    !isLegacyType && canExecuteMovementRequest(session) && canExecuteMovementRequestStatus(request.status);
  const canCancel =
    !isLegacyType &&
    canCancelMovementRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds) &&
    canCancelMovementRequestStatus(request.status);
  // Tambah Posisi: Admin SDM picks the real seat when carrying it out.
  const isAddPosition = isAddPositionType(request.movementType);
  // A Mutasi or Tambah Posisi that named a Jabatan and a unit: the seat is picked when it is carried out.
  const isJobBased = !!request.proposedJobId && !(request.movementType !== "ADD_POSITION" && request.status === "IMPLEMENTED");
  const addCandidates =
    canExecute && request.proposedJobId && request.proposedOrgUnitId
      ? await prisma.position.findMany({
          where: { jobId: request.proposedJobId, orgUnitId: request.proposedOrgUnitId, archived: false },
          orderBy: { positionCode: "asc" },
          select: {
            id: true,
            positionCode: true,
            jobLevel: true,
            assignments: {
              where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
              select: {
                employeeId: true,
                assignmentType: true,
                employee: { select: { fullLegalName: true, offboardingCases: { where: { status: "PENDING_CLEARANCE" }, select: { lastWorkingDay: true } } } },
              },
            },
          },
        })
      : [];
  const canEditHrFields = !isLegacyType && isHrAdminUser && request.status !== "IMPLEMENTED" && request.status !== "CANCELLED";

  // A return/reject reason is meant for the requester to act on — always
  // shown regardless of viewer. An approval's own note may carry internal
  // remarks, so it's only shown to privileged viewers.
  const showHrDecisionNote = canSeeConfidential || request.status === "REJECTED" || request.status === "RETURNED";
  const showDeptHeadDecisionNote =
    canSeeConfidential || request.status === "REJECTED" || request.status === "RETURNED";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Perubahan Posisi", href: "/movements" }, { label: "Detail Permintaan" }]} />
      {isLegacyType && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t("movement.legacyTypeNotice")}
        </div>
      )}
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          request.origin === "REKRUTMEN_INTERNAL" ? "border-indigo-200 bg-indigo-50 text-indigo-900" : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <b>Sumber: {MOVEMENT_ORIGIN_LABEL[request.origin]}.</b>{" "}
        {request.origin === "REKRUTMEN_INTERNAL" && request.recruitmentCandidate ? (
          <>
            Karyawan ini melamar {request.recruitmentCandidate.request.job?.jobTitle ?? "lowongan internal"} ({request.recruitmentCandidate.request.requestNumber}), lulus tes dan interview.
            {(canManageRecruitment(session) || isHrManagerNow) && (
              <>
                {" "}
                <Link href={`/recruitment/${request.recruitmentCandidate.request.id}`} className="font-medium underline">
                  Buka permintaan
                </Link>
              </>
            )}
          </>
        ) : request.recruitmentRequest ? (
          <>
            Mengisi {request.recruitmentRequest.requestNumber} lewat tombol &quot;Isi dengan Mutasi&quot;, tanpa pelamar.
            {(canManageRecruitment(session) || isHrManagerNow) && (
              <>
                {" "}
                <Link href={`/recruitment/${request.recruitmentRequest.id}`} className="font-medium underline">
                  Buka permintaan
                </Link>
              </>
            )}
          </>
        ) : (
          <>Diajukan oleh {request.requesterEmployee.fullLegalName}. Tidak terkait permintaan tenaga kerja.</>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{request.requestNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {request.employee.fullLegalName} ({request.employee.employeeNumber})
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
            {request.movementType === "ADD_POSITION" && <p className="mt-1 text-xs text-slate-500">{t("movement.addPositionHint")}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("movement.currentPosition")}</p>
            <p className="text-sm text-slate-900">
              {request.currentPosition.jobLevel} {request.currentPosition.job.jobTitle} (
              {request.currentPosition.positionCode})
            </p>
            <p className="text-xs text-slate-400">{request.currentPosition.orgUnit.unitName}</p>
          </div>
          {isJobBased ? (
            <div>
              <p className="text-xs text-slate-500">{t("movement.proposedJob")}</p>
              <p className="text-sm text-slate-900">{request.proposedJob?.jobTitle ?? "—"}</p>
              <p className="text-xs text-slate-400">
                {t("movement.proposedUnit")}: {request.proposedOrgUnit?.unitName ?? "—"}
                {request.proposedJobLevel && ` · level yang dituju: ${request.proposedJobLevel}`}
                {request.status !== "IMPLEMENTED" && " · posisi dipilih saat dilaksanakan"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500">{t("movement.proposedPosition")}</p>
              <p className="text-sm text-slate-900">
                {request.proposedPosition.jobLevel} {request.proposedPosition.job.jobTitle} (
                {request.proposedPosition.positionCode})
              </p>
              <p className="text-xs text-slate-400">{request.proposedPosition.orgUnit.unitName}</p>
            </div>
          )}
          {!isLegacyType && !request.deptHeadDecisionAt && request.status !== "PENDING_DEPT_HEAD" && (
            <div>
              <p className="text-xs text-slate-500">Persetujuan</p>
              <p className="text-sm text-slate-900">{t("movement.approvalHrManagerOnly")}</p>
            </div>
          )}
          {request.proposedEmploymentStatus && (
            <div>
              <p className="text-xs text-slate-500">{t("movement.proposedEmploymentStatus")}</p>
              <p className="text-sm text-slate-900">{t(`employmentStatus.${request.proposedEmploymentStatus}`)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">{t("movement.proposedEffectiveDate")}</p>
            <p className="text-sm text-slate-900">{formatDateLong(request.proposedEffectiveDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.submittedBy")}</p>
            <p className="text-sm text-slate-900">
              {request.requesterEmployee.fullLegalName}
              {request.requesterPosition ? ` (${request.requesterPosition.job.jobTitle})` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500">{t("movement.requestReason")}</p>
          <p className="text-sm text-slate-900">{request.requestReason}</p>
        </div>

        {request.performanceEvaluationRef && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("movement.performanceEvaluationRef")}</p>
            <p className="text-sm text-slate-900">{request.performanceEvaluationRef}</p>
          </div>
        )}
      </div>

      {request.evaluationId && <EvaluationPanel evaluationId={request.evaluationId} linkToDetail />}

      {decisionBlockedByEvaluation && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t("evaluation.completionRequiredNotice")}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
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
          {t("recruitment.submittedBy")}: {request.submittedByAccount.usernameOrEmail} ({formatDateLong(request.submittedAt)})
          {request.deptHeadDecisionByAccount && (
            <>
              {" · "}
              {t("recruitment.deptHeadDecisionBy")}: {request.deptHeadDecisionByAccount.usernameOrEmail} (
              {formatDateLong(request.deptHeadDecisionAt)})
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
              {t("recruitment.approvedBy")}: {request.decisionByAccount.usernameOrEmail} ({formatDateLong(request.decisionAt)})
              {request.decisionPosition && (
                <> — {t("recruitment.decisionPosition")}: {request.decisionPosition.job.jobTitle} ({request.decisionPosition.positionCode})</>
              )}
            </>
          )}
          {request.implementedByAccount && (
            <>
              {" · "}
              {t("movement.implementedBy")}: {request.implementedByAccount.usernameOrEmail} ({formatDateLong(request.implementedAt)})
            </>
          )}
          {request.status === "CANCELLED" && (
            <>
              {" · "}
              {t("recruitment.cancelledBy")}:{" "}
              {request.cancelledByEmployee?.fullLegalName ?? request.cancelledByAccount?.usernameOrEmail ?? "—"}
              {" "}({t(`cancellationAuthority.${request.cancellationAuthority}`)}, {formatDateLong(request.cancelledAt)})
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
          {request.proposedJobId ? (
            <ExecuteAddPositionForm
              requestId={request.id}
              mode={isAddPosition ? "ADD_POSITION" : "MUTATION"}
              positions={addCandidates
                // a Mutasi moves the employee into a seat nobody holds as their main placement
                // a holder who is leaving (exit case waiting for clearance) does not block the seat
                .filter((p) => isAddPosition || (!p.assignments.some((a) => a.assignmentType === "PRIMARY" && a.employee.offboardingCases.length === 0) && (!request.proposedJobLevel || p.jobLevel === request.proposedJobLevel)))
                .map((p) => ({
                id: p.id,
                label: `${p.positionCode} — ${p.jobLevel} ${request.proposedJob?.jobTitle ?? ""} (${request.proposedOrgUnit?.unitName ?? ""})${p.assignments.length ? `, dipegang ${p.assignments.map((a) => a.employee.fullLegalName + (a.employee.offboardingCases[0]?.lastWorkingDay ? ` (keluar ${formatDateMedium(a.employee.offboardingCases[0].lastWorkingDay)})` : "")).join(", ")}` : ", kosong"}`,
                heldByEmployee: p.assignments.some((a) => a.employeeId === request.employeeId),
              }))}
            />
          ) : (
            <ExecuteMovementButton requestId={request.id} />
          )}
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

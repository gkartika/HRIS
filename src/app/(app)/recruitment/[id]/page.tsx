import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { formatDateLong } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canApproveRecruitmentRequest,
  canApproveRecruitmentRequestAsDeptHead,
  canCreateEmployeeFromRequest,
  canCancelRecruitmentRequest,
  isHrAdmin,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  computeFulfillmentCounts,
  canRequestAcceptFulfillment,
  canCancelRequestStatus,
  canCloseRequestStatus,
  canResubmitRequestStatus,
} from "@/lib/recruitment";
import { findVacantPositionsInDepartment } from "@/lib/recruitment-seats";
import {
  StartReviewButton,
  DecisionButtons,
  DeptHeadDecisionButtons,
  CancelRequestForm,
  CloseRequestForm,
} from "./decision-forms";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function RecruitmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id },
    include: {
      department: true,
      job: true,
      requesterEmployee: true,
      requesterPosition: { include: { job: true } },
      submittedByAccount: true,
      deptHeadDecisionByAccount: true,
      deptHeadDecisionPosition: { include: { job: true } },
      approvedByAccount: true,
      decisionPosition: { include: { job: true } },
      cancelledByAccount: true,
      cancelledByEmployee: true,
      closedByAccount: true,
      fulfillments: {
        include: { employee: true, assignment: { include: { position: { include: { job: true } } } } },
      },
    },
  });
  if (!request) notFound();

  const isOwnRequest = request.requesterEmployeeId === session.user.employeeId;
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const activeHrManagerPositionIds = hrManagerPositions.map((p) => p.positionId);
  const isHrManagerNow = activeHrManagerPositionIds.length > 0;
  const deptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, request.departmentId);
  const activeDeptHeadPositionIds = deptHeadPositions.map((p) => p.positionId);
  const isDeptHeadNow = activeDeptHeadPositionIds.length > 0;

  if (!isHrAdmin(session) && !isHrManagerNow && !isDeptHeadNow && !isOwnRequest) {
    return <AccessDenied />;
  }

  const counts = computeFulfillmentCounts(request.requestedHeadcount, request.fulfillments.length);
  const canApprove = canApproveRecruitmentRequest(activeHrManagerPositionIds);
  const canApproveAsDeptHead =
    canApproveRecruitmentRequestAsDeptHead(activeDeptHeadPositionIds) && request.status === "PENDING_DEPT_HEAD";
  // Jabatan is no longer chosen by the requester — the HR Manager sets it
  // here as part of Approve, so the job list only needs fetching when this
  // session could actually reach that decision.
  const jobs = canApprove ? await prisma.job.findMany({ orderBy: { jobTitle: "asc" } }) : [];
  // Heads-up for the HR Manager: how many vacant seats exist per job in this
  // department, so a request for more people than seats is noticed early.
  const vacantByJob: Record<string, number> = {};
  if (canApprove && (request.status === "SUBMITTED" || request.status === "UNDER_REVIEW")) {
    for (const p of await findVacantPositionsInDepartment(request.departmentId)) {
      vacantByJob[p.jobId] = (vacantByJob[p.jobId] ?? 0) + 1;
    }
  }
  const canFulfill =
    canCreateEmployeeFromRequest(session) && canRequestAcceptFulfillment(request.status) && !counts.isFull;
  const canClose = canCloseRequestStatus(request.status) && (isHrAdmin(session) || isHrManagerNow);
  const canResubmit = canResubmitRequestStatus(request.status) && (isOwnRequest || isHrAdmin(session));
  const canCancel =
    canCancelRecruitmentRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds) &&
    canCancelRequestStatus(request.status);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Rekrutmen", href: "/recruitment" }, { label: "Detail Permintaan" }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{request.requestNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {request.job?.jobTitle ?? t("recruitment.jobPendingApproval")} — {request.department.unitName}
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {t(`recruitmentStatus.${request.status}`)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.requestDate")}</p>
            <p className="text-sm text-slate-900">{formatDateLong(request.requestDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.reasonCode")}</p>
            <p className="text-sm text-slate-900">{t(`recruitmentReasonCode.${request.reasonCode}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.shiftCode")}</p>
            <p className="text-sm text-slate-900">{t(`shiftCode.${request.shiftCode}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.requestedHeadcount")}</p>
            <p className="text-sm text-slate-900">{request.requestedHeadcount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.fulfillment")}</p>
            <p className="text-sm text-slate-900">
              {t("recruitment.filledOf", { filled: counts.filledCount, total: request.requestedHeadcount })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.educationRequirement")}</p>
            <p className="text-sm text-slate-900">{t(`educationRequirementCode.${request.educationRequirementCode}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.workExperience")}</p>
            <p className="text-sm text-slate-900">{t(`workExperienceBand.${request.workExperienceBand}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.ageBand")}</p>
            <p className="text-sm text-slate-900">{t(`ageBandLabel.${request.ageBand}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.genderRequirement")}</p>
            <p className="text-sm text-slate-900">
              {request.genderRequirement ? t(`gender.${request.genderRequirement}`) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("recruitment.requestedJobLevel")}</p>
            <p className="text-sm text-slate-900">{t(`requestedJobLevel.${request.requestedJobLevel}`)}</p>
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
          <p className="text-xs text-slate-500">{t("recruitment.jobDescription")}</p>
          <p className="text-sm text-slate-900">{request.jobDescriptionSnapshot}</p>
        </div>
        {request.specialCriteria && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.specialCriteria")}</p>
            <p className="text-sm text-slate-900">{request.specialCriteria}</p>
          </div>
        )}
        {request.deptHeadDecisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">
              {t("recruitment.decisionNote")} ({t("recruitment.deptHeadApprovalSectionTitle")})
            </p>
            <p className="text-sm text-slate-900">{request.deptHeadDecisionNote}</p>
          </div>
        )}
        {request.decisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.decisionNote")}</p>
            <p className="text-sm text-slate-900">{request.decisionNote}</p>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-400">
          {t("recruitment.submittedBy")}: {request.submittedByAccount?.usernameOrEmail ?? "—"} (
          {formatDateLong(request.submittedAt)})
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
          {request.approvedByAccount && (
            <>
              {" · "}
              {t("recruitment.approvedBy")}: {request.approvedByAccount.usernameOrEmail} ({formatDateLong(request.approvedAt)})
              {request.decisionPosition && (
                <> — {t("recruitment.decisionPosition")}: {request.decisionPosition.job.jobTitle} ({request.decisionPosition.positionCode})</>
              )}
            </>
          )}
          {request.status === "CLOSED" && (
            <>
              {" · "}
              {t("recruitment.closedBy")}: {request.closedByAccount?.usernameOrEmail ?? "—"} (
              {formatDateLong(request.closedAt)}){request.closeReason && <> — {request.closeReason}</>}
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

      {canResubmit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-900">{t("recruitment.resubmitTitle")}</p>
          <p className="mt-1 text-sm text-amber-800">{t("recruitment.resubmitHint")}</p>
          <Link
            href={`/recruitment/${request.id}/edit`}
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("recruitment.resubmitButton")}
          </Link>
        </div>
      )}
      {canApproveAsDeptHead && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("recruitment.deptHeadApprovalSectionTitle")}</p>
          <DeptHeadDecisionButtons requestId={request.id} positions={deptHeadPositions} />
        </div>
      )}
      {canApprove && request.status === "SUBMITTED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <StartReviewButton requestId={request.id} />
          </div>
          <div className="mt-3">
            <DecisionButtons
              requestId={request.id}
              positions={hrManagerPositions}
              jobs={jobs}
              defaultJobId={request.jobId}
              vacantByJob={vacantByJob}
              requestedHeadcount={request.requestedHeadcount}
            />
          </div>
        </div>
      )}
      {canApprove && request.status === "UNDER_REVIEW" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <DecisionButtons
            requestId={request.id}
            positions={hrManagerPositions}
            jobs={jobs}
            defaultJobId={request.jobId}
            vacantByJob={vacantByJob}
            requestedHeadcount={request.requestedHeadcount}
          />
        </div>
      )}
      {canClose && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-1 text-sm font-medium text-slate-900">{t("recruitment.closeRequestTitle")}</p>
          <p className="mb-3 text-xs text-slate-500">{t("recruitment.closeRequestHint")}</p>
          <CloseRequestForm requestId={request.id} />
        </div>
      )}
      {canCancel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("recruitment.cancelRequestButton")}</p>
          <CancelRequestForm requestId={request.id} />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900">{t("recruitment.linkedEmployees")}</h2>
          {canFulfill && (
            <Link
              href={`/recruitment/${request.id}/create-employee`}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              {t("recruitment.createEmployeeFromRequest")}
            </Link>
          )}
        </div>
        {request.fulfillments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{t("recruitment.noLinkedEmployees")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {request.fulfillments.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-sm"
              >
                <Link href={`/employees/${f.employeeId}`} className="text-indigo-600 hover:underline">
                  {f.employee.fullLegalName} ({f.employee.employeeNumber})
                </Link>
                <span className="text-xs text-slate-500">{f.assignment.position.job.jobTitle}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

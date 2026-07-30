import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canApproveRecruitmentRequest,
  canCreateEmployeeFromRequest,
  canCancelRecruitmentRequest,
  isHrAdmin,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeFulfillmentCounts, canRequestAcceptFulfillment, canCancelRequestStatus } from "@/lib/recruitment";
import { StartReviewButton, DecisionButtons, CancelRequestForm } from "./decision-forms";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}

export default async function RecruitmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id },
    include: {
      department: true,
      job: true,
      requestedPosition: { include: { job: true, orgUnit: true } },
      requesterEmployee: true,
      requesterPosition: { include: { job: true } },
      submittedByAccount: true,
      approvedByAccount: true,
      decisionPosition: { include: { job: true } },
      cancelledByAccount: true,
      cancelledByEmployee: true,
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

  if (!isHrAdmin(session) && !isHrManagerNow && !isOwnRequest) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const counts = computeFulfillmentCounts(request.requestedHeadcount, request.fulfillments.length);
  const canApprove = canApproveRecruitmentRequest(activeHrManagerPositionIds);
  // Jabatan is no longer chosen by the requester — the HR Manager sets it
  // here as part of Approve, so the job list only needs fetching when this
  // session could actually reach that decision.
  const jobs = canApprove ? await prisma.job.findMany({ orderBy: { jobTitle: "asc" } }) : [];
  const canFulfill =
    canCreateEmployeeFromRequest(session) && canRequestAcceptFulfillment(request.status) && !counts.isFull;
  const canCancel =
    canCancelRecruitmentRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds) &&
    canCancelRequestStatus(request.status);

  return (
    <div className="space-y-6">
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
            <p className="text-sm text-slate-900">{formatDate(request.requestDate)}</p>
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
            <p className="text-xs text-slate-500">{t("recruitment.requestedPosition")}</p>
            <p className="text-sm text-slate-900">{request.requestedPosition?.positionCode ?? "—"}</p>
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
              {request.requesterEmployee.preferredName ?? request.requesterEmployee.fullLegalName}
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
        {request.decisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.decisionNote")}</p>
            <p className="text-sm text-slate-900">{request.decisionNote}</p>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-400">
          {t("recruitment.submittedBy")}: {request.submittedByAccount?.usernameOrEmail ?? "—"} (
          {formatDate(request.submittedAt)})
          {request.approvedByAccount && (
            <>
              {" · "}
              {t("recruitment.approvedBy")}: {request.approvedByAccount.usernameOrEmail} ({formatDate(request.approvedAt)})
              {request.decisionPosition && (
                <> — {t("recruitment.decisionPosition")}: {request.decisionPosition.job.jobTitle} ({request.decisionPosition.positionCode})</>
              )}
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

      {canApprove && request.status === "SUBMITTED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <StartReviewButton requestId={request.id} />
          </div>
          <div className="mt-3">
            <DecisionButtons requestId={request.id} positions={hrManagerPositions} jobs={jobs} />
          </div>
        </div>
      )}
      {canApprove && request.status === "UNDER_REVIEW" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <DecisionButtons requestId={request.id} positions={hrManagerPositions} jobs={jobs} />
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
                  {f.employee.preferredName ?? f.employee.fullLegalName} ({f.employee.employeeNumber})
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

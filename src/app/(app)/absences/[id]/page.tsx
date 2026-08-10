import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canViewAbsenceRequest,
  canDecideAbsenceRequestAsFirstApprover,
  canDecideAbsenceRequestAsHrAdmin,
  canOverrideAbsenceRequest,
  canCancelAbsenceRequest,
} from "@/lib/permissions";
import {
  canDecideAbsenceRequestAsFirstApproverStatus,
  canDecideAbsenceRequestAsHrAdminStatus,
  canHrOverrideAbsenceRequestStatus,
  canCancelAbsenceRequestStatus,
  absenceDayCount,
} from "@/lib/absence";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  FirstApproverDecisionButtons,
  HrAdminDecisionButtons,
  OverrideForm,
  CancelAbsenceForm,
} from "./decision-forms";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(date);
}

export default async function AbsenceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.absenceRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { fullLegalName: true, preferredName: true, employeeNumber: true } },
      attachmentFile: true,
      firstApproverPosition: { include: { job: true } },
      firstDecisionByAccount: { select: { usernameOrEmail: true } },
      hrAdminDecisionByAccount: { select: { usernameOrEmail: true } },
      hrOverrideByAccount: { select: { usernameOrEmail: true } },
      cancelledByAccount: { select: { usernameOrEmail: true } },
    },
  });
  if (!request) notFound();

  const [isLevel3InDepartment, approverPositionHolderEmployeeIds] = await Promise.all([
    isLevel3ForEmployeeDepartment(session.user.employeeId, request.employeeId),
    getCurrentHolderEmployeeIds(request.firstApproverPositionId),
  ]);

  if (!canViewAbsenceRequest(session, request.employeeId, isLevel3InDepartment, approverPositionHolderEmployeeIds)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const canDecideFirst =
    canDecideAbsenceRequestAsFirstApprover(session.user.employeeId, approverPositionHolderEmployeeIds) &&
    canDecideAbsenceRequestAsFirstApproverStatus(request.status);
  const canDecideHr = canDecideAbsenceRequestAsHrAdmin(session) && canDecideAbsenceRequestAsHrAdminStatus(request.status);
  const canOverride = canOverrideAbsenceRequest(session) && canHrOverrideAbsenceRequestStatus(request.status);
  const canCancel =
    canCancelAbsenceRequest(session, request.employeeId, request.submittedByAccountId) &&
    canCancelAbsenceRequestStatus(request.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">{request.requestNumber}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {request.employee.preferredName ?? request.employee.fullLegalName} ({request.employee.employeeNumber})
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">{t("absence.typeLabel")}</p>
            <p className="mt-1 text-slate-900">{t(`absenceType.${request.absenceType}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 text-slate-900">
              {t(`absenceStatus.${request.status}`)}
              {request.isHrOverride && (
                <span className="ml-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  {t("absence.overrideBadge")}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("absence.startDateLabel")}</p>
            <p className="mt-1 text-slate-900">{formatDate(request.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("absence.endDateLabel")}</p>
            <p className="mt-1 text-slate-900">
              {formatDate(request.endDate)} ({absenceDayCount(request.startDate, request.endDate)} hari)
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-500">{t("absence.reasonLabel")}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-900">{request.reason}</p>
          </div>
          {request.attachmentFile && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">{t("absence.attachmentLabel")}</p>
              <a
                href={`/api/files/${request.attachmentFile.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-indigo-600 hover:underline"
              >
                {request.attachmentFile.originalFileName}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-900">{t("absence.firstApproverDecisionTitle")}</p>
        {!request.firstApproverPositionId && (
          <p className="mt-2 text-xs text-amber-700">{t("absence.noFirstApproverWarning")}</p>
        )}
        {request.firstApproverPosition && (
          <p className="mt-1 text-xs text-slate-500">
            Penyetuju: {request.firstApproverPosition.jobLevel} {request.firstApproverPosition.job.jobTitle}
          </p>
        )}
        {request.firstDecisionAt && (
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(request.firstDecisionAt)} — {request.firstDecisionByAccount?.usernameOrEmail ?? "—"}
            {request.firstDecisionNote && `: ${request.firstDecisionNote}`}
          </p>
        )}
        {canDecideFirst && (
          <div className="mt-3">
            <FirstApproverDecisionButtons requestId={request.id} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-900">{t("absence.hrAdminDecisionTitle")}</p>
        {request.hrAdminDecisionAt && (
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(request.hrAdminDecisionAt)} — {request.hrAdminDecisionByAccount?.usernameOrEmail ?? "—"}
            {request.hrAdminDecisionNote && `: ${request.hrAdminDecisionNote}`}
          </p>
        )}
        {request.hrOverrideAt && (
          <p className="mt-2 text-xs text-amber-700">
            {t("absence.overrideBadge")}: {formatDate(request.hrOverrideAt)} — {request.hrOverrideByAccount?.usernameOrEmail ?? "—"}
            {request.hrOverrideReason && `: ${request.hrOverrideReason}`}
          </p>
        )}
        {request.cancelledAt && (
          <p className="mt-2 text-xs text-rose-700">
            Dibatalkan {formatDate(request.cancelledAt)} — {request.cancelledByAccount?.usernameOrEmail ?? "—"}
            {request.cancellationReason && `: ${request.cancellationReason}`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {canDecideHr && <HrAdminDecisionButtons requestId={request.id} />}
          {canOverride && <OverrideForm requestId={request.id} />}
          {canCancel && <CancelAbsenceForm requestId={request.id} />}
        </div>
      </div>
    </div>
  );
}

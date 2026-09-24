import { notFound } from "next/navigation";
import { formatDateLong } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import {
  canViewAbsenceRequest,
  canDecideAbsenceRequestAsFirstApprover,
  canDecideAbsenceRequestAsSecondApprover,
  canDecideAbsenceRequestAsHrAdmin,
  canOverrideAbsenceRequest,
  canCancelAbsenceRequest,
} from "@/lib/permissions";
import {
  canDecideAbsenceRequestAsFirstApproverStatus,
  canDecideAbsenceRequestAsSecondApproverStatus,
  canDecideAbsenceRequestAsHrAdminStatus,
  canHrOverrideAbsenceRequestStatus,
  canCancelAbsenceRequestStatus,
  absenceDayCount,
} from "@/lib/absence";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { resolveAnnualQuota, usedDaysThisYear } from "@/lib/absence-quota";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  FirstApproverDecisionButtons,
  SecondApproverDecisionButtons,
  HrAdminDecisionButtons,
  OverrideForm,
  CancelAbsenceForm,
} from "./decision-forms";

// Shared shape between the first- and second-approver cards below — same
// title/approver-line/decision-line/buttons structure, differing only in
// which fields feed them and (for the first stage only) the two extra
// "not required"/"no approver configured" messages passed via `extra`.
function ApprovalStageCard({
  title,
  approverPosition,
  decisionAt,
  decisionByUsername,
  decisionNote,
  extra,
  children,
}: {
  title: string;
  approverPosition: { jobLevel: string; job: { jobTitle: string } } | null | undefined;
  decisionAt: Date | null;
  decisionByUsername: string | null | undefined;
  decisionNote: string | null;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {extra}
      {approverPosition && (
        <p className="mt-1 text-xs text-slate-500">
          Penyetuju: {approverPosition.jobLevel} {approverPosition.job.jobTitle}
        </p>
      )}
      {decisionAt && (
        <p className="mt-2 text-xs text-slate-500">
          {formatDateLong(decisionAt)} — {decisionByUsername ?? "—"}
          {decisionNote && `: ${decisionNote}`}
        </p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default async function AbsenceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.absenceRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      attachmentFile: true,
      absenceType: true,
      firstApproverPosition: { include: { job: true } },
      firstDecisionByAccount: { select: { usernameOrEmail: true } },
      secondApproverPosition: { include: { job: true } },
      secondDecisionByAccount: { select: { usernameOrEmail: true } },
      hrAdminDecisionByAccount: { select: { usernameOrEmail: true } },
      hrOverrideByAccount: { select: { usernameOrEmail: true } },
      cancelledByAccount: { select: { usernameOrEmail: true } },
    },
  });
  if (!request) notFound();

  const [isLevel3InDepartment, approverPositionHolderEmployeeIds, secondApproverPositionHolderEmployeeIds, quota, usedBeforeThis] =
    await Promise.all([
      isLevel3ForEmployeeDepartment(session.user.employeeId, request.employeeId),
      getCurrentHolderEmployeeIds(request.firstApproverPositionId),
      getCurrentHolderEmployeeIds(request.secondApproverPositionId),
      resolveAnnualQuota(request.employeeId, request.absenceTypeCode),
      usedDaysThisYear(request.employeeId, request.absenceTypeCode, request.id),
    ]);

  if (
    !canViewAbsenceRequest(
      session,
      request.employeeId,
      isLevel3InDepartment,
      approverPositionHolderEmployeeIds,
      secondApproverPositionHolderEmployeeIds
    )
  ) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const thisRequestDays = absenceDayCount(request.startDate, request.endDate);
  const totalDaysIfApproved = usedBeforeThis + thisRequestDays;
  const overQuota = quota !== null && totalDaysIfApproved > quota;

  const canDecideFirst =
    canDecideAbsenceRequestAsFirstApprover(session.user.employeeId, approverPositionHolderEmployeeIds) &&
    canDecideAbsenceRequestAsFirstApproverStatus(request.status);
  const canDecideSecond =
    canDecideAbsenceRequestAsSecondApprover(session.user.employeeId, secondApproverPositionHolderEmployeeIds) &&
    canDecideAbsenceRequestAsSecondApproverStatus(request.status);
  const canDecideHr = canDecideAbsenceRequestAsHrAdmin(session) && canDecideAbsenceRequestAsHrAdminStatus(request.status);
  const canOverride = canOverrideAbsenceRequest(session) && canHrOverrideAbsenceRequestStatus(request.status);
  const canCancel =
    canCancelAbsenceRequest(session, request.employeeId, request.submittedByAccountId) &&
    canCancelAbsenceRequestStatus(request.status);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Absensi", href: "/absences" }, { label: "Detail Pengajuan" }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{request.requestNumber}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {request.employee.fullLegalName} ({request.employee.employeeNumber})
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">{t("absence.typeLabel")}</p>
            <p className="mt-1 text-slate-900">{request.absenceType.label}</p>
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
            <p className="mt-1 text-slate-900">{formatDateLong(request.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("absence.endDateLabel")}</p>
            <p className="mt-1 text-slate-900">
              {formatDateLong(request.endDate)} ({absenceDayCount(request.startDate, request.endDate)} hari)
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
        {overQuota && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {t("absence.overQuotaWarning", {
              type: request.absenceType.label,
              used: usedBeforeThis,
              thisRequest: thisRequestDays,
              total: totalDaysIfApproved,
              quota: quota!,
            })}
          </p>
        )}
      </div>

      <ApprovalStageCard
        title={t("absence.firstApproverDecisionTitle")}
        approverPosition={request.firstApproverPosition}
        decisionAt={request.firstDecisionAt}
        decisionByUsername={request.firstDecisionByAccount?.usernameOrEmail}
        decisionNote={request.firstDecisionNote}
        extra={
          <>
            {!request.absenceType.requiresFirstApproval && (
              <p className="mt-2 text-xs text-slate-500">{t("absence.firstApproverNotRequired")}</p>
            )}
            {request.absenceType.requiresFirstApproval && !request.firstApproverPositionId && (
              <p className="mt-2 text-xs text-amber-700">{t("absence.noFirstApproverWarning")}</p>
            )}
          </>
        }
      >
        {canDecideFirst && <FirstApproverDecisionButtons requestId={request.id} />}
      </ApprovalStageCard>

      {request.secondApproverPositionId && (
        <ApprovalStageCard
          title={t("absence.secondApproverDecisionTitle")}
          approverPosition={request.secondApproverPosition}
          decisionAt={request.secondDecisionAt}
          decisionByUsername={request.secondDecisionByAccount?.usernameOrEmail}
          decisionNote={request.secondDecisionNote}
        >
          {canDecideSecond && <SecondApproverDecisionButtons requestId={request.id} />}
        </ApprovalStageCard>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-900">{t("absence.hrAdminDecisionTitle")}</p>
        {request.hrAdminDecisionAt && (
          <p className="mt-2 text-xs text-slate-500">
            {formatDateLong(request.hrAdminDecisionAt)} — {request.hrAdminDecisionByAccount?.usernameOrEmail ?? "—"}
            {request.hrAdminDecisionNote && `: ${request.hrAdminDecisionNote}`}
          </p>
        )}
        {request.hrOverrideAt && (
          <p className="mt-2 text-xs text-amber-700">
            {t("absence.overrideBadge")}: {formatDateLong(request.hrOverrideAt)} — {request.hrOverrideByAccount?.usernameOrEmail ?? "—"}
            {request.hrOverrideReason && `: ${request.hrOverrideReason}`}
          </p>
        )}
        {request.cancelledAt && (
          <p className="mt-2 text-xs text-rose-700">
            Dibatalkan {formatDateLong(request.cancelledAt)} — {request.cancelledByAccount?.usernameOrEmail ?? "—"}
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

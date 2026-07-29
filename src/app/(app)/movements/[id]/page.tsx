import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canApproveMovementRequest,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  isHrAdmin,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
} from "@/lib/movement";
import { MovementDecisionButtons, ExecuteMovementButton, CancelMovementForm } from "./decision-forms";

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

  if (!isHrAdmin(session) && !isHrManagerNow && !isOwnRequest) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const canDecide = canApproveMovementRequest(activeHrManagerPositionIds) && canDecideMovementRequestStatus(request.status);
  const canExecute = canExecuteMovementRequest(session) && canExecuteMovementRequestStatus(request.status);
  const canCancel =
    canCancelMovementRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds) &&
    canCancelMovementRequestStatus(request.status);

  return (
    <div className="space-y-6">
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
              {request.currentPosition.job.jobTitle} ({request.currentPosition.positionCode})
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("movement.proposedPosition")}</p>
            <p className="text-sm text-slate-900">
              {request.proposedPosition.job.jobTitle} ({request.proposedPosition.positionCode})
            </p>
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
        {request.decisionNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("recruitment.decisionNote")}</p>
            <p className="text-sm text-slate-900">{request.decisionNote}</p>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          {t("recruitment.submittedBy")}: {request.submittedByAccount.usernameOrEmail} ({formatDate(request.submittedAt)})
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

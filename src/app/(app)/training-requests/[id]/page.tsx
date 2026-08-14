import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  isHrAdmin,
  isTrainingAdmin,
  canViewTrainingRequest,
  canDecideTrainingRequestAsDeptHead,
  canValidateTrainingRequest,
  canScheduleTrainingRequest,
  canCancelTrainingRequest as canCancelTrainingRequestByActor,
} from "@/lib/permissions";
import {
  canDeptHeadDecideTrainingRequest,
  canTrainingAdminValidateTrainingRequest,
  canTrainingAdminScheduleTrainingRequest,
  canCancelTrainingRequest as canCancelTrainingRequestStatus,
} from "@/lib/training";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { DeptHeadDecisionForm } from "./dept-head-decision-form";
import { ValidateForm } from "./validate-form";
import { ScheduleForm } from "./schedule-form";
import { CancelForm } from "./cancel-form";

export default async function TrainingRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.trainingRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { fullLegalName: true, preferredName: true, employeeNumber: true } },
      departmentSnapshot: { select: { unitName: true } },
      course: true,
      session: true,
      submittedByAccount: { select: { usernameOrEmail: true } },
      deptHeadDecisionByAccount: { select: { usernameOrEmail: true } },
      trainingAdminDecisionByAccount: { select: { usernameOrEmail: true } },
    },
  });
  if (!request) notFound();

  const deptHeadPositions = request.departmentIdSnapshot
    ? await getActiveDeptHeadPositions(session.user.employeeId, request.departmentIdSnapshot)
    : [];
  const canView = canViewTrainingRequest(
    session,
    request.employeeId,
    request.submittedByAccountId,
    deptHeadPositions.map((p) => p.positionId)
  );
  if (!canView) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const isAdmin = isHrAdmin(session) || isTrainingAdmin(session);
  const canDecideDeptHead =
    canDecideTrainingRequestAsDeptHead(deptHeadPositions.map((p) => p.positionId)) && canDeptHeadDecideTrainingRequest(request.status);
  const canValidate = canValidateTrainingRequest(session) && canTrainingAdminValidateTrainingRequest(request.status);
  const canSchedule = canScheduleTrainingRequest(session) && canTrainingAdminScheduleTrainingRequest(request.status);
  const isRequester = session.user.id === request.submittedByAccountId;
  const canCancel = canCancelTrainingRequestByActor(session, isRequester) && canCancelTrainingRequestStatus(request.status);

  const courses = canValidate ? await prisma.trainingCourse.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" } }) : [];
  const sessions =
    canSchedule && request.courseId
      ? await prisma.trainingSession.findMany({ where: { courseId: request.courseId }, orderBy: { startDate: "asc" } })
      : [];

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">
        {request.requestNumber} — {request.employee.preferredName ?? request.employee.fullLegalName}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {request.employee.employeeNumber} · {request.departmentSnapshot?.unitName ?? "—"}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">{t("trainingRequest.requestedTopicLabel")}</p>
          <p className="mt-1 text-slate-900">{request.requestedTopic}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{t("trainingRequest.reasonLabel")}</p>
          <p className="mt-1 text-slate-900">{t(`trainingRequest.reasonOptions.${request.reason}`)}</p>
        </div>
        {request.gapReferenceNote && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.gapReferenceNoteLabel")}</p>
            <p className="mt-1 text-slate-900">{request.gapReferenceNote}</p>
          </div>
        )}
        {request.businessJustification && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.businessJustificationLabel")}</p>
            <p className="mt-1 text-slate-900">{request.businessJustification}</p>
          </div>
        )}
        {request.preferredTiming && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.preferredTimingLabel")}</p>
            <p className="mt-1 text-slate-900">{request.preferredTiming}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500">{t("trainingRequest.statusLabel")}</p>
          <p className="mt-1 text-slate-900">{t(`trainingRequestStatus.${request.status}`)}</p>
        </div>
        {request.course && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.courseLabel")}</p>
            <p className="mt-1 text-slate-900">{request.course.title}</p>
          </div>
        )}
        {request.session && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.sessionLabel")}</p>
            <p className="mt-1 text-slate-900">{request.session.startDate.toISOString().slice(0, 10)}</p>
          </div>
        )}
        {request.deptHeadNote && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.deptHeadDecisionTitle")}</p>
            <p className="mt-1 text-slate-900">{request.deptHeadNote}</p>
          </div>
        )}
        {request.cancellationReason && (
          <div>
            <p className="text-xs text-slate-500">{t("trainingRequest.cancellationReasonLabel")}</p>
            <p className="mt-1 text-slate-900">{request.cancellationReason}</p>
          </div>
        )}
      </div>

      {canDecideDeptHead && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-slate-900">{t("trainingRequest.deptHeadDecisionTitle")}</h2>
          <DeptHeadDecisionForm requestId={request.id} />
        </div>
      )}

      {canValidate && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-slate-900">{t("trainingRequest.validateTitle")}</h2>
          <ValidateForm requestId={request.id} courses={courses} />
        </div>
      )}

      {canSchedule && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-slate-900">{t("trainingRequest.scheduleTitle")}</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400">
              Belum ada sesi untuk pelatihan ini —{" "}
              <Link href={`/training/courses/${request.courseId}`} className="text-indigo-600 hover:underline">
                tambah sesi
              </Link>{" "}
              terlebih dahulu.
            </p>
          ) : (
            <ScheduleForm requestId={request.id} sessions={sessions} />
          )}
        </div>
      )}

      {canCancel && (
        <div className="mt-4">
          <CancelForm requestId={request.id} />
        </div>
      )}

      {isAdmin && (
        <p className="mt-6 text-xs text-slate-400">
          Diajukan oleh {request.submittedByAccount.usernameOrEmail}
          {request.deptHeadDecisionByAccount && ` · Keputusan Kepala Departemen oleh ${request.deptHeadDecisionByAccount.usernameOrEmail}`}
          {request.trainingAdminDecisionByAccount && ` · Diproses Training Admin oleh ${request.trainingAdminDecisionByAccount.usernameOrEmail}`}
        </p>
      )}
    </div>
  );
}

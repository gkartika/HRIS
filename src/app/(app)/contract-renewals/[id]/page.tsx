import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  isHrAdmin,
  canReviewContractRenewalCase,
  canSubmitRenewalEvaluationAs,
  canSubmitRenewalDeptHeadRecommendation,
  canDecideContractRenewalCase,
  canViewContractRenewalCase,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  canSendRenewalEvaluation,
  canSubmitRenewalEvaluation,
  canSubmitDeptHeadRecommendation,
  canDecideRenewalCase,
  requiresLinkedMovement,
  type RenewalEvaluationScores,
} from "@/lib/contract-renewal";
import { isOverdue } from "@/lib/work-calendar";
import {
  SendEvaluationForm,
  EvaluationForm,
  DeptHeadRecommendationForm,
  HrManagerDecisionButtons,
  GenerateContractForm,
} from "./decision-forms";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}

function EvaluationSummary({ scores, total }: { scores: unknown; total: number | null }) {
  const s = (scores ?? {}) as RenewalEvaluationScores;
  const entries: [string, number][] = [];
  const push = (key: keyof RenewalEvaluationScores, label: string) => {
    const v = s[key];
    if (typeof v === "number") entries.push([label, v]);
  };
  push("kpiProductivity", t("contractRenewal.kpiProductivity"));
  push("qualityOrientation", t("contractRenewal.qualityOrientation"));
  push("problemSolving", t("contractRenewal.problemSolving"));
  push("communicationLeadership", t("contractRenewal.communicationLeadership"));
  push("technicalExpertise", t("contractRenewal.technicalExpertise"));
  push("workDiscipline", t("contractRenewal.workDiscipline"));
  push("absensi", t("contractRenewal.absensi"));
  push("tugasKhusus", t("contractRenewal.tugasKhusus"));
  push("sp", t("contractRenewal.sp"));
  push("kompetensi", t("contractRenewal.kompetensi"));
  s.companyValues?.forEach((v, i) => {
    if (typeof v === "number") entries.push([`${t("contractRenewal.companyValue1").replace("1", String(i + 1))}`, v]);
  });

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-3">
      {entries.map(([label, v]) => (
        <div key={label}>
          {label}: <span className="font-medium text-slate-900">{v}</span>
        </div>
      ))}
      <div className="col-span-full mt-1 text-sm font-medium text-slate-900">
        {t("contractRenewal.total")}: {total ?? "—"}
      </div>
    </div>
  );
}

export default async function ContractRenewalCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const renewalCase = await prisma.contractRenewalCase.findUnique({
    where: { id },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      currentContract: true,
      snapshotPosition: { include: { job: true, orgUnit: true } },
      p1Employee: true,
      p1Position: { include: { job: true } },
      p2Employee: true,
      p2Position: { include: { job: true } },
      deptHeadEmployee: true,
      deptHeadPosition: { include: { job: true } },
      deptHeadProposedPosition: { include: { job: true } },
      decisionByAccount: true,
      decisionPosition: { include: { job: true } },
      linkedMovementRequest: true,
      generatedContract: true,
      responsibleHrAdminAccount: true,
    },
  });
  if (!renewalCase) notFound();

  const isHrAdminUser = isHrAdmin(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const departmentId = await resolveDepartmentId(renewalCase.snapshotPosition.orgUnitId);
  const deptHeadPositions = departmentId
    ? await getActiveDeptHeadPositions(session.user.employeeId, departmentId)
    : [];

  if (
    !canViewContractRenewalCase(
      session,
      session.user.employeeId,
      renewalCase.p1EmployeeId,
      renewalCase.p2EmployeeId,
      deptHeadPositions.map((p) => p.positionId),
      hrManagerPositions.map((p) => p.positionId)
    )
  ) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const isViewerP1 = canSubmitRenewalEvaluationAs(session.user.employeeId, renewalCase.p1EmployeeId);
  const isViewerP2 = canSubmitRenewalEvaluationAs(session.user.employeeId, renewalCase.p2EmployeeId);
  const isReviewer = isHrAdminUser || deptHeadPositions.length > 0 || hrManagerPositions.length > 0;

  const canSend = canReviewContractRenewalCase(session) && canSendRenewalEvaluation(renewalCase.status);
  const canP1Submit = isViewerP1 && canSubmitRenewalEvaluation(renewalCase.status, renewalCase.p1SubmittedAt);
  const canP2Submit = isViewerP2 && canSubmitRenewalEvaluation(renewalCase.status, renewalCase.p2SubmittedAt);
  const canDeptHeadRecommend =
    canSubmitRenewalDeptHeadRecommendation(deptHeadPositions.map((p) => p.positionId)) &&
    canSubmitDeptHeadRecommendation(renewalCase.status, renewalCase.p1SubmittedAt, renewalCase.p2SubmittedAt);
  const canHrManagerDecide =
    canDecideContractRenewalCase(hrManagerPositions.map((p) => p.positionId)) && canDecideRenewalCase(renewalCase.status);
  const canGenerateContract =
    isHrAdminUser &&
    renewalCase.status === "APPROVED" &&
    !!renewalCase.finalRecommendation &&
    requiresLinkedMovement(renewalCase.finalRecommendation) &&
    renewalCase.linkedMovementRequest?.status === "IMPLEMENTED" &&
    !renewalCase.generatedContractId;

  const [employees, positions] = await Promise.all([
    canSend ? prisma.employee.findMany({ orderBy: { fullLegalName: "asc" } }) : Promise.resolve([]),
    canDeptHeadRecommend || canHrManagerDecide
      ? prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } })
      : Promise.resolve([]),
  ]);

  const overdue = isOverdue(renewalCase.evaluationDueDate);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{renewalCase.caseNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/employees/${renewalCase.employeeId}`} className="text-indigo-600 hover:underline">
                {renewalCase.employee.preferredName ?? renewalCase.employee.fullLegalName}
              </Link>{" "}
              ({renewalCase.employee.employeeNumber})
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {t(`contractRenewalCaseStatus.${renewalCase.status}`)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">{t("contract.contractNumber")}</p>
            <Link href={`/contracts/${renewalCase.currentContractId}`} className="font-mono text-xs text-indigo-600 hover:underline">
              {renewalCase.currentContract.contractNumber}
            </Link>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("contractRenewal.triggerDate")}</p>
            <p className="text-sm text-slate-900">{formatDate(renewalCase.triggerDate)}</p>
          </div>
          {renewalCase.evaluationDueDate && (
            <div>
              <p className="text-xs text-slate-500">{t("contractRenewal.evaluationDueDate")}</p>
              <p className={`text-sm ${overdue ? "text-rose-600" : "text-slate-900"}`}>
                {formatDate(renewalCase.evaluationDueDate)}
                {overdue && ` — ${t("contractRenewal.evaluationOverdueNotice")}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {canSend && <SendEvaluationForm caseId={renewalCase.id} employees={employees} />}

      {renewalCase.status !== "TRIGGERED" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-900">
              {t("contractRenewal.p1EvaluationTitle")} — {renewalCase.p1Employee?.preferredName ?? renewalCase.p1Employee?.fullLegalName}
            </p>
            {renewalCase.p1SubmittedAt ? (
              (isViewerP1 || isReviewer) ? (
                <EvaluationSummary scores={renewalCase.p1Scores} total={renewalCase.p1Total} />
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("contractRenewal.evaluationSubmittedNotice")}</p>
              )
            ) : canP1Submit ? null : (
              <p className="mt-2 text-xs text-slate-400">—</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-900">
              {t("contractRenewal.p2EvaluationTitle")} — {renewalCase.p2Employee?.preferredName ?? renewalCase.p2Employee?.fullLegalName}
            </p>
            {renewalCase.p2SubmittedAt ? (
              (isViewerP2 || isReviewer) ? (
                <EvaluationSummary scores={renewalCase.p2Scores} total={renewalCase.p2Total} />
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("contractRenewal.evaluationSubmittedNotice")}</p>
              )
            ) : canP2Submit ? null : (
              <p className="mt-2 text-xs text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {canP1Submit && <EvaluationForm caseId={renewalCase.id} slot="P1" />}
      {canP2Submit && <EvaluationForm caseId={renewalCase.id} slot="P2" />}

      {canDeptHeadRecommend && (
        <DeptHeadRecommendationForm
          caseId={renewalCase.id}
          positions={positions}
          decisionPositions={deptHeadPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
        />
      )}

      {renewalCase.deptHeadRecommendation && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">{t("contractRenewal.deptHeadRecommendationTitle")}</p>
          <p className="text-sm text-slate-900">
            {t(`renewalRecommendation.${renewalCase.deptHeadRecommendation}`)} —{" "}
            {renewalCase.deptHeadEmployee?.preferredName ?? renewalCase.deptHeadEmployee?.fullLegalName}
            {renewalCase.deptHeadPosition ? ` (${renewalCase.deptHeadPosition.job.jobTitle})` : ""}
          </p>
          {renewalCase.deptHeadProposedPosition && (
            <p className="mt-1 text-sm text-slate-600">
              {t("contractRenewal.proposedPosition")}: {renewalCase.deptHeadProposedPosition.job.jobTitle} (
              {renewalCase.deptHeadProposedPosition.positionCode})
            </p>
          )}
          {renewalCase.deptHeadNote && <p className="mt-1 text-sm text-slate-600">{renewalCase.deptHeadNote}</p>}
        </div>
      )}

      {renewalCase.linkedMovementRequest && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">{t("contractRenewal.linkedMovementTitle")}</p>
          <Link href={`/movements/${renewalCase.linkedMovementRequest.id}`} className="font-mono text-sm text-indigo-600 hover:underline">
            {renewalCase.linkedMovementRequest.requestNumber}
          </Link>{" "}
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {t(`movementStatus.${renewalCase.linkedMovementRequest.status}`)}
          </span>
        </div>
      )}

      {canHrManagerDecide && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-900">{t("contractRenewal.hrManagerDecisionTitle")}</p>
          <HrManagerDecisionButtons
            caseId={renewalCase.id}
            positions={positions}
            decisionPositions={hrManagerPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
            deptHeadRecommendation={renewalCase.deptHeadRecommendation}
          />
        </div>
      )}

      {renewalCase.decisionByAccount && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">{t("contractRenewal.hrManagerDecisionTitle")}</p>
          <p className="text-sm text-slate-900">
            {renewalCase.finalRecommendation && t(`renewalRecommendation.${renewalCase.finalRecommendation}`)} —{" "}
            {renewalCase.decisionByAccount.usernameOrEmail} ({formatDate(renewalCase.decisionAt)})
            {renewalCase.decisionPosition && ` (${renewalCase.decisionPosition.job.jobTitle})`}
          </p>
          {renewalCase.changeReason && (
            <p className="mt-1 text-sm text-slate-600">
              {t("contractRenewal.changeReason")}: {renewalCase.changeReason}
            </p>
          )}
          {renewalCase.decisionNote && <p className="mt-1 text-sm text-slate-600">{renewalCase.decisionNote}</p>}
        </div>
      )}

      {renewalCase.status === "APPROVED" &&
        renewalCase.finalRecommendation &&
        requiresLinkedMovement(renewalCase.finalRecommendation) &&
        !renewalCase.generatedContractId &&
        renewalCase.linkedMovementRequest?.status !== "IMPLEMENTED" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t("contractRenewal.generateContractButtonBlocked")}
          </p>
        )}

      {canGenerateContract && <GenerateContractForm caseId={renewalCase.id} />}

      {renewalCase.generatedContract && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">{t("contractRenewal.generatedContract")}</p>
          <Link href={`/contracts/${renewalCase.generatedContract.id}`} className="font-mono text-sm text-indigo-600 hover:underline">
            {renewalCase.generatedContract.contractNumber}
          </Link>
        </div>
      )}
    </div>
  );
}

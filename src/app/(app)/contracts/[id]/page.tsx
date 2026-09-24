import Link from "next/link";
import { formatDateLong } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canViewContractDetail,
  canManageContracts,
  canSubmitContractRecommendation,
  canDecideContractRenewal,
  canApproveContractRelease,
  canSignContract,
  isHrAdmin,
  canSubmitRenewalDeptHeadRecommendation,
  canDecideContractRenewalCase,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  computeExpiryUrgency,
  canSubmitContractRecommendation as canSubmitRecommendationStatus,
  canDecideContractRenewal as canDecideRenewalStatus,
  canCreateRenewalDraft,
  canReleaseContract,
  canSignContractStatus,
  canActivateContract,
} from "@/lib/contract";
import { canSubmitDeptHeadRecommendation, canDecideRenewalCase, requiresLinkedMovement } from "@/lib/contract-renewal";
import { isEvaluationComplete } from "@/lib/evaluation";
import {
  RecommendationForm,
  RenewalDecisionButtons,
  CreateRenewalDraftForm,
  ReleaseContractForm,
  SignButton,
  ActivateButton,
} from "./decision-forms";
import {
  DeptHeadRecommendationForm,
  HrManagerDecisionButtons,
  GenerateContractForm,
  CreateOffboardingHandoffForm,
} from "./renewal-decision-forms";
import { EvaluationPanel } from "../../evaluations/evaluation-panel";
import type { Position, Job, OrgUnit } from "@/generated/prisma/client";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      primaryAssignment: { include: { position: { include: { job: true, orgUnit: true } } } },
      renewedFromContract: true,
      renewedByContract: true,
      recommendationByEmployee: true,
      recommendationByPosition: { include: { job: true } },
      decisionByAccount: true,
      decisionPosition: { include: { job: true } },
      renewalCaseAsCurrentContract: {
        include: {
          deptHeadEmployee: true,
          deptHeadPosition: { include: { job: true } },
          deptHeadProposedPosition: { include: { job: true } },
          decisionByAccount: true,
          decisionPosition: { include: { job: true } },
          linkedMovementRequest: true,
          generatedContract: true,
          offboardingCase: true,
          employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
        },
      },
    },
  });
  if (!contract) notFound();

  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isManager = await isDirectManagerOfEmployee(session.user.employeeId, contract.employeeId);
  // Resolved once, up front, so both the view gate below and the D-30 case
  // section further down (which needs the exact same department/Dept-Head
  // lookup) share one computation instead of duplicating it.
  const contractDepartmentId = contract.employee.currentPosition
    ? await resolveDepartmentId(contract.employee.currentPosition.orgUnitId)
    : null;
  const deptHeadPositions = contractDepartmentId
    ? await getActiveDeptHeadPositions(session.user.employeeId, contractDepartmentId)
    : [];

  if (
    !canViewContractDetail(
      session,
      contract.employeeId,
      hrManagerPositions.map((p) => p.positionId),
      isManager,
      deptHeadPositions.map((p) => p.positionId)
    )
  ) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const urgency = computeExpiryUrgency(contract.status, contract.endDate);

  const canManage = canManageContracts(session);
  // The old manual "Mulai Tinjauan Perpanjangan" entry point is retired —
  // the D-30 automated Renewal Case (below) is now the one canonical
  // renewal workflow (never two separate modules). These later-stage
  // manual-pipeline controls are kept only so a contract already mid-flow
  // under the old REVIEW_REQUESTED/RECOMMENDATION_SUBMITTED/
  // APPROVED_FOR_RENEWAL states (none exist as of this change) can still be
  // completed and displayed — non-destructive to history, not a new entry
  // point.
  const canRecommend =
    canSubmitContractRecommendation(session, isManager) && canSubmitRecommendationStatus(contract.status);
  const canDecide =
    canDecideContractRenewal(hrManagerPositions.map((p) => p.positionId)) && canDecideRenewalStatus(contract.status);
  const canDraft = canManage && canCreateRenewalDraft(contract.status);
  const canRelease =
    canApproveContractRelease(hrManagerPositions.map((p) => p.positionId)) && canReleaseContract(contract.status);
  const canSign = canSignContract(session, contract.employeeId) && canSignContractStatus(contract.status);
  const canActivate = canManage && canActivateContract(contract.status);

  const employees = canRecommend && isHrAdmin(session) ? await prisma.employee.findMany({ orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } }) : [];

  // Contract + its D-30 Renewal Case are one module/workflow — render the
  // whole case inline on this same page rather than a separate route.
  const renewalCase = contract.renewalCaseAsCurrentContract;
  let renewalPositions: (Position & { job: Job; orgUnit: OrgUnit })[] = [];
  let canSubmitDeptHead = false;
  let canDecideCombined = false;
  let canGenerateContract = false;
  let canCreateOffboardingHandoff = false;

  if (renewalCase) {
    // renewalCase.employeeId === contract.employeeId always (the case is
    // for this same contract's employee) — deptHeadPositions was already
    // resolved for this exact department above, for the view gate.
    const evaluationStatus = renewalCase.evaluationId
      ? (await prisma.evaluation.findUnique({ where: { id: renewalCase.evaluationId }, select: { status: true } }))?.status ?? "DRAFT"
      : "DRAFT";

    canSubmitDeptHead =
      canSubmitRenewalDeptHeadRecommendation(deptHeadPositions.map((p) => p.positionId)) &&
      canSubmitDeptHeadRecommendation(renewalCase.status) &&
      isEvaluationComplete(evaluationStatus);
    canDecideCombined =
      canDecideContractRenewalCase(hrManagerPositions.map((p) => p.positionId)) && canDecideRenewalCase(renewalCase.status);
    canGenerateContract =
      canManage &&
      renewalCase.status === "APPROVED" &&
      !!renewalCase.finalRecommendation &&
      requiresLinkedMovement(renewalCase.finalRecommendation) &&
      renewalCase.linkedMovementRequest?.status === "IMPLEMENTED" &&
      !renewalCase.generatedContractId;
    canCreateOffboardingHandoff =
      canManage &&
      renewalCase.status === "APPROVED" &&
      renewalCase.finalRecommendation === "TIDAK_DIPERPANJANG" &&
      !renewalCase.offboardingCase;

    if (canSubmitDeptHead || canDecideCombined) {
      renewalPositions = await prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Kontrak", href: "/contracts" }, { label: "Detail Kontrak" }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{contract.contractNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/employees/${contract.employeeId}`} className="text-indigo-600 hover:underline">
                {contract.employee.fullLegalName}
              </Link>{" "}
              ({contract.employee.employeeNumber})
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {t(`contractStatus.${contract.status}`)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">{t("contract.contractType")}</p>
            <p className="text-sm text-slate-900">{t(`employmentStatus.${contract.contractType}`)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("contract.startDate")}</p>
            <p className="text-sm text-slate-900">{formatDateLong(contract.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("contract.endDate")}</p>
            <p className="text-sm text-slate-900">
              {contract.endDate ? formatDateLong(contract.endDate) : t("contract.indefinite")}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("contract.primaryAssignment")}</p>
            <p className="text-sm text-slate-900">
              {contract.primaryAssignment
                ? `${contract.primaryAssignment.position.job.jobTitle} (${contract.primaryAssignment.position.positionCode}) — ${contract.primaryAssignment.position.orgUnit.unitName}`
                : "—"}
            </p>
          </div>
          {urgency !== "NONE" && (
            <div>
              <p className="text-xs text-slate-500">{t("contract.expiryUrgency")}</p>
              <p className="text-sm text-rose-600">{t(`expiryUrgency.${urgency}`)}</p>
            </div>
          )}
          {contract.renewedFromContract && (
            <div>
              <p className="text-xs text-slate-500">{t("contract.renewedFrom")}</p>
              <Link href={`/contracts/${contract.renewedFromContract.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                {contract.renewedFromContract.contractNumber}
              </Link>
            </div>
          )}
          {contract.renewedByContract && (
            <div>
              <p className="text-xs text-slate-500">{t("contract.renewedBy")}</p>
              <Link href={`/contracts/${contract.renewedByContract.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                {contract.renewedByContract.contractNumber}
              </Link>
            </div>
          )}
        </div>

        {contract.recommendation && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">{t("contract.recommendationTitle")}</p>
            <p className="text-sm text-slate-900">
              {t(`contractRenewalRecommendation.${contract.recommendation}`)} —{" "}
              {contract.recommendationByEmployee?.fullLegalName}
              {contract.recommendationByPosition ? ` (${contract.recommendationByPosition.job.jobTitle})` : ""}
            </p>
            {contract.recommendationNote && <p className="mt-1 text-sm text-slate-600">{contract.recommendationNote}</p>}
          </div>
        )}

        {contract.decisionByAccount && (
          <p className="mt-4 text-xs text-slate-400">
            {t("recruitment.approvedBy")}: {contract.decisionByAccount.usernameOrEmail} ({formatDateLong(contract.decisionAt)})
            {contract.decisionPosition && (
              <> — {t("recruitment.decisionPosition")}: {contract.decisionPosition.job.jobTitle} ({contract.decisionPosition.positionCode})</>
            )}
            {contract.decisionNote && <> — {contract.decisionNote}</>}
          </p>
        )}
      </div>

      {canRecommend && (
        <RecommendationForm
          contractId={contract.id}
          employees={employees}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdmin(session)}
        />
      )}

      {canDecide && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <RenewalDecisionButtons contractId={contract.id} positions={hrManagerPositions} />
        </div>
      )}

      {canDraft && (
        <CreateRenewalDraftForm contractId={contract.id} defaultContractType={contract.contractType} />
      )}

      {canRelease && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <ReleaseContractForm contractId={contract.id} positions={hrManagerPositions} />
        </div>
      )}

      {canSign && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <SignButton contractId={contract.id} />
        </div>
      )}

      {canActivate && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <ActivateButton contractId={contract.id} />
        </div>
      )}

      {/* D-30 automated Renewal Case — same module, rendered inline. */}
      {renewalCase && (
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900">
              {t("contractRenewal.caseNumber")}: <span className="font-mono">{renewalCase.caseNumber}</span>
            </h2>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {t(`contractRenewalCaseStatus.${renewalCase.status}`)}
            </span>
          </div>

          {renewalCase.evaluationId && <EvaluationPanel evaluationId={renewalCase.evaluationId} linkToDetail />}

          {renewalCase.deptHeadRecommendation && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-xs text-slate-500">{t("contractRenewal.deptHeadRecommendationTitle")}</p>
              <p className="text-sm text-slate-900">
                {t(`renewalRecommendation.${renewalCase.deptHeadRecommendation}`)} —{" "}
                {renewalCase.deptHeadEmployee?.fullLegalName}
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

          {canSubmitDeptHead && (
            <DeptHeadRecommendationForm
              caseId={renewalCase.id}
              positions={renewalPositions}
              decisionPositions={deptHeadPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
            />
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

          {canDecideCombined && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="mb-3 text-sm font-medium text-slate-900">{t("contractRenewal.hrManagerDecisionTitle")}</p>
              <HrManagerDecisionButtons
                caseId={renewalCase.id}
                positions={renewalPositions}
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
                {renewalCase.decisionByAccount.usernameOrEmail} ({formatDateLong(renewalCase.decisionAt)})
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

          {canCreateOffboardingHandoff && <CreateOffboardingHandoffForm caseId={renewalCase.id} />}

          {renewalCase.offboardingCase && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-xs text-slate-500">{t("offboarding.linkedCase")}</p>
              <Link href={`/offboarding/${renewalCase.offboardingCase.id}`} className="font-mono text-sm text-indigo-600 hover:underline">
                {renewalCase.offboardingCase.caseNumber}
              </Link>{" "}
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {t(`offboardingCaseStatus.${renewalCase.offboardingCase.status}`)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

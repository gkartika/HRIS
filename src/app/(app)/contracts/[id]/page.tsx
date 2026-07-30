import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canViewContractDetail,
  canManageContracts,
  canSubmitContractRecommendation,
  canDecideContractRenewal,
  canSignContract,
  isHrAdmin,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  computeExpiryUrgency,
  canStartContractReview,
  canSubmitContractRecommendation as canSubmitRecommendationStatus,
  canDecideContractRenewal as canDecideRenewalStatus,
  canCreateRenewalDraft,
  canReleaseContract,
  canSignContractStatus,
  canActivateContract,
} from "@/lib/contract";
import {
  StartReviewButton,
  RecommendationForm,
  RenewalDecisionButtons,
  CreateRenewalDraftForm,
  ReleaseButton,
  SignButton,
  ActivateButton,
} from "./decision-forms";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      renewedFromContract: true,
      renewedByContract: true,
      recommendationByEmployee: true,
      recommendationByPosition: { include: { job: true } },
      decisionByAccount: true,
      decisionPosition: { include: { job: true } },
    },
  });
  if (!contract) notFound();

  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isManager = await isDirectManagerOfEmployee(session.user.employeeId, contract.employeeId);

  if (
    !canViewContractDetail(
      session,
      contract.employeeId,
      hrManagerPositions.map((p) => p.positionId),
      isManager
    )
  ) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const urgency = computeExpiryUrgency(contract.status, contract.endDate);

  const canManage = canManageContracts(session);
  const canStartReview = canManage && canStartContractReview(contract.status);
  const canRecommend =
    canSubmitContractRecommendation(session, isManager) && canSubmitRecommendationStatus(contract.status);
  const canDecide =
    canDecideContractRenewal(hrManagerPositions.map((p) => p.positionId)) && canDecideRenewalStatus(contract.status);
  const canDraft = canManage && canCreateRenewalDraft(contract.status);
  const canRelease = canManage && canReleaseContract(contract.status);
  const canSign = canSignContract(session, contract.employeeId) && canSignContractStatus(contract.status);
  const canActivate = canManage && canActivateContract(contract.status);

  const employees = canRecommend && isHrAdmin(session) ? await prisma.employee.findMany({ orderBy: { fullLegalName: "asc" } }) : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{contract.contractNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/employees/${contract.employeeId}`} className="text-indigo-600 hover:underline">
                {contract.employee.preferredName ?? contract.employee.fullLegalName}
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
            <p className="text-sm text-slate-900">{formatDate(contract.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("contract.endDate")}</p>
            <p className="text-sm text-slate-900">
              {contract.endDate ? formatDate(contract.endDate) : t("contract.indefinite")}
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
              {contract.recommendationByEmployee?.preferredName ?? contract.recommendationByEmployee?.fullLegalName}
              {contract.recommendationByPosition ? ` (${contract.recommendationByPosition.job.jobTitle})` : ""}
            </p>
            {contract.recommendationNote && <p className="mt-1 text-sm text-slate-600">{contract.recommendationNote}</p>}
          </div>
        )}

        {contract.decisionByAccount && (
          <p className="mt-4 text-xs text-slate-400">
            {t("recruitment.approvedBy")}: {contract.decisionByAccount.usernameOrEmail} ({formatDate(contract.decisionAt)})
            {contract.decisionPosition && (
              <> — {t("recruitment.decisionPosition")}: {contract.decisionPosition.job.jobTitle} ({contract.decisionPosition.positionCode})</>
            )}
            {contract.decisionNote && <> — {contract.decisionNote}</>}
          </p>
        )}
      </div>

      {canStartReview && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <StartReviewButton contractId={contract.id} />
        </div>
      )}

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
          <ReleaseButton contractId={contract.id} />
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
    </div>
  );
}

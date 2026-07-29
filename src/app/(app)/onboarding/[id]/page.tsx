import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canViewOnboarding,
  canMarkOnboardingContract,
  canMarkOnboardingTraining,
  canMarkOnboardingAssets,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeOnboardingStatus } from "@/lib/onboarding";
import { ContractToggle, TrainingToggle, AssetsToggle, DueDateForm } from "./toggle-buttons";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(date));
}
function toDateInputValue(date: Date | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export default async function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canViewOnboarding(session, hrManagerPositions.map((p) => p.positionId))) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const onboardingCase = await prisma.onboardingCase.findUnique({
    where: { id },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      contractCompletedByAccount: true,
      mandatoryMaterialCompletedByAccount: true,
      assetsCompletedByAccount: true,
    },
  });
  if (!onboardingCase) notFound();

  const overallStatus = computeOnboardingStatus({
    contractComplete: onboardingCase.contractComplete,
    mandatoryMaterialComplete: onboardingCase.mandatoryMaterialComplete,
    assetsComplete: onboardingCase.assetsComplete,
    plannedStartDate: onboardingCase.plannedStartDate,
    mandatoryMaterialDueDate: onboardingCase.mandatoryMaterialDueDate,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{onboardingCase.caseNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/employees/${onboardingCase.employeeId}`} className="text-indigo-600 hover:underline">
                {onboardingCase.employee.preferredName ?? onboardingCase.employee.fullLegalName}
              </Link>{" "}
              ({onboardingCase.employee.employeeNumber}) —{" "}
              {onboardingCase.employee.currentPosition
                ? `${onboardingCase.employee.currentPosition.job.jobTitle} · ${onboardingCase.employee.currentPosition.orgUnit.unitName}`
                : t("employee.noPosition")}
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              overallStatus === "COMPLETE"
                ? "bg-emerald-50 text-emerald-700"
                : overallStatus === "OVERDUE"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {t(`onboardingStatus.${overallStatus}`)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">{t("onboarding.plannedStartDate")}</p>
            <p className="text-sm text-slate-900">{formatDate(onboardingCase.plannedStartDate)}</p>
          </div>
          {onboardingCase.completedAt && (
            <div>
              <p className="text-xs text-slate-500">{t("onboarding.completedAt")}</p>
              <p className="text-sm text-slate-900">{formatDate(onboardingCase.completedAt)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="mb-3 text-sm font-medium text-slate-900">{t("onboarding.tasksTitle")}</p>
        <div className="space-y-2">
          <ContractToggle
            caseId={onboardingCase.id}
            complete={onboardingCase.contractComplete}
            canToggle={canMarkOnboardingContract(session)}
          />
          {onboardingCase.contractCompletedByAccount && (
            <p className="pl-1 text-xs text-slate-400">
              {onboardingCase.contractCompletedByAccount.usernameOrEmail} ({formatDate(onboardingCase.contractCompletedAt)})
            </p>
          )}

          <TrainingToggle
            caseId={onboardingCase.id}
            complete={onboardingCase.mandatoryMaterialComplete}
            canToggle={canMarkOnboardingTraining(session)}
          />
          {onboardingCase.mandatoryMaterialCompletedByAccount && (
            <p className="pl-1 text-xs text-slate-400">
              {onboardingCase.mandatoryMaterialCompletedByAccount.usernameOrEmail} (
              {formatDate(onboardingCase.mandatoryMaterialCompletedAt)})
            </p>
          )}
          <DueDateForm
            caseId={onboardingCase.id}
            dueDate={toDateInputValue(onboardingCase.mandatoryMaterialDueDate)}
            canEdit={canMarkOnboardingTraining(session)}
          />

          <AssetsToggle
            caseId={onboardingCase.id}
            complete={onboardingCase.assetsComplete}
            canToggle={canMarkOnboardingAssets(session)}
          />
          {onboardingCase.assetsCompletedByAccount && (
            <p className="pl-1 text-xs text-slate-400">
              {onboardingCase.assetsCompletedByAccount.usernameOrEmail} ({formatDate(onboardingCase.assetsCompletedAt)})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

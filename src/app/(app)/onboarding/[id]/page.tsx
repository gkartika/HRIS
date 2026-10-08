import { LEARNING_STATUS_LABEL } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { formatDateLong } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canViewOnboarding,
  canMarkOnboardingContract,
  canMarkOnboardingTraining,
  canManageAssets,
  canCreateOnboardingCase,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getOnboardingTrainingStatusesForEmployee } from "@/lib/mandatory-training";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  computeOnboardingStatus,
  isOnboardingTrainingComplete,
  isOnboardingAssetsComplete,
  onboardingTrainingNote,
  canCancelOnboardingCase,
} from "@/lib/onboarding";
import { ContractToggle, DueDateForm } from "./toggle-buttons";
import { CancelOnboardingForm, ReopenOnboardingButton, PlannedStartDateForm } from "./case-controls";
import { AssignAssetDuringOnboardingForm } from "./assign-asset-form";
import { Breadcrumbs } from "@/components/breadcrumbs";

function toDateInputValue(date: Date | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export default async function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canViewOnboarding(session, hrManagerPositions.map((p) => p.positionId))) {
    return <AccessDenied />;
  }

  const onboardingCase = await prisma.onboardingCase.findUnique({
    where: { id },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      contractCompletedByAccount: true,
      cancelledByAccount: true,
    },
  });
  if (!onboardingCase) notFound();

  const trainingAssignments = await getOnboardingTrainingStatusesForEmployee(onboardingCase.employeeId);
  // No placement yet: nothing could have been assigned, so this is not "done".
  const hasPlacement = !!onboardingCase.employee.currentPositionId;
  const trainingStatuses = trainingAssignments.map((a) => a.status);
  const trainingComplete = isOnboardingTrainingComplete(trainingStatuses, hasPlacement);
  const trainingNote = onboardingTrainingNote(trainingStatuses, hasPlacement);
  const isCancelled = !!onboardingCase.cancelledAt;
  const canManageCase = canCreateOnboardingCase(session);

  // Phase 4A: "Perlengkapan Selesai" is derived live from real AssetCustody
  // rows for the employee, same pattern as training above — no manual
  // toggle, no GA-Admin gate on visibility (anyone who can view this case
  // sees the same real custody list, same as the training block).
  const assetCustodies = await prisma.assetCustody.findMany({
    where: { employeeId: onboardingCase.employeeId },
    orderBy: { assignedAt: "desc" },
    include: { asset: { select: { assetCode: true, assetName: true } } },
  });
  const assetsComplete = isOnboardingAssetsComplete(assetCustodies.map((c) => c.status));

  // GA Admin can assign standard equipment to the new employee directly
  // from this case, instead of navigating to /assets — same AVAILABLE-only
  // filter used by the GA request "allocate" flow.
  const canAssignAssets = canManageAssets(session);
  const availableAssets = canAssignAssets
    ? await prisma.fixedAsset.findMany({
        where: {
          activeFlag: true,
          OR: [{ trackingType: "INDIVIDUAL", status: "AVAILABLE" }, { trackingType: "QUANTITY_TRACKED", availableQuantity: { gt: 0 } }],
        },
        orderBy: { assetCode: "asc" },
      })
    : [];

  const overallStatus = computeOnboardingStatus({
    contractComplete: onboardingCase.contractComplete,
    mandatoryMaterialComplete: trainingComplete,
    assetsComplete,
    plannedStartDate: onboardingCase.plannedStartDate,
    mandatoryMaterialDueDate: onboardingCase.mandatoryMaterialDueDate,
    cancelledAt: onboardingCase.cancelledAt,
  });

  // Derive-on-read, same precedent as ContractRenewalCase's D-30 trigger:
  // training completion can happen entirely outside this page (e.g. the
  // learner passes a quiz), so opportunistically stamp completedAt the
  // next time this case is viewed after all three become true, rather than
  // only on a contract toggle click.
  if (!isCancelled && !onboardingCase.completedAt && onboardingCase.contractComplete && trainingComplete && assetsComplete) {
    await prisma.onboardingCase.update({ where: { id: onboardingCase.id }, data: { completedAt: new Date() } });
    onboardingCase.completedAt = new Date();
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Onboarding", href: "/onboarding" }, { label: "Detail Kasus" }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{onboardingCase.caseNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/employees/${onboardingCase.employeeId}`} className="text-indigo-600 hover:underline">
                {onboardingCase.employee.fullLegalName}
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
                  : overallStatus === "CANCELLED"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-600"
            }`}
          >
            {t(`onboardingStatus.${overallStatus}`)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* Admin SDM sees the date inside the edit form below; everyone else sees it here. */}
          {!(canManageCase && !isCancelled) && (
            <div>
              <p className="text-xs text-slate-500">{t("onboarding.plannedStartDate")}</p>
              <p className="text-sm text-slate-900">{formatDateLong(onboardingCase.plannedStartDate)}</p>
            </div>
          )}
          {onboardingCase.completedAt && (
            <div>
              <p className="text-xs text-slate-500">{t("onboarding.completedAt")}</p>
              <p className="text-sm text-slate-900">{formatDateLong(onboardingCase.completedAt)}</p>
            </div>
          )}
        </div>
        {canManageCase && !isCancelled && (
          <PlannedStartDateForm
            caseId={onboardingCase.id}
            plannedStartDate={toDateInputValue(onboardingCase.plannedStartDate)}
          />
        )}
        {canManageCase && canCancelOnboardingCase(onboardingCase) && (
          <div className="mt-4">
            <CancelOnboardingForm caseId={onboardingCase.id} />
          </div>
        )}
      </div>

      {isCancelled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4">
          <div>
            <p className="text-sm font-medium text-slate-800">{t("onboarding.cancelledBanner")}</p>
            <p className="mt-1 text-sm text-slate-600">
              {onboardingCase.cancellationReason ?? "—"}
              {onboardingCase.cancelledByAccount && (
                <span className="text-xs text-slate-400">
                  {" "}
                  — {onboardingCase.cancelledByAccount.usernameOrEmail} ({formatDateLong(onboardingCase.cancelledAt)})
                </span>
              )}
            </p>
          </div>
          {canManageCase && <ReopenOnboardingButton caseId={onboardingCase.id} />}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="mb-3 text-sm font-medium text-slate-900">{t("onboarding.tasksTitle")}</p>
        <div className="space-y-2">
          <ContractToggle
            caseId={onboardingCase.id}
            complete={onboardingCase.contractComplete}
            canToggle={canMarkOnboardingContract(session) && !isCancelled}
          />
          {onboardingCase.contractCompletedByAccount && (
            <p className="pl-1 text-xs text-slate-400">
              {onboardingCase.contractCompletedByAccount.usernameOrEmail} ({formatDateLong(onboardingCase.contractCompletedAt)})
            </p>
          )}

          <div className="rounded-lg border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  trainingComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {trainingComplete ? "✓" : "—"}
              </span>
              <span className="text-sm text-slate-900">{t("onboarding.mandatoryMaterialComplete")}</span>
              <span className="text-xs text-slate-400">(berdasarkan penyelesaian pelatihan wajib onboarding)</span>
            </div>
            {trainingAssignments.length > 0 && (
              <ul className="mt-2 space-y-1 pl-7 text-xs text-slate-500">
                {trainingAssignments.map((a) => (
                  <li key={a.id}>
                    {a.course.title} — {LEARNING_STATUS_LABEL[a.status]}
                  </li>
                ))}
              </ul>
            )}
            {trainingNote && (
              <p className={`mt-2 pl-7 text-xs ${trainingNote === "WAITING_FOR_PLACEMENT" ? "text-amber-700" : "text-slate-500"}`}>
                {trainingNote === "WAITING_FOR_PLACEMENT"
                  ? t("onboarding.trainingWaitingForPlacement")
                  : t("onboarding.trainingNoneForPosition")}
              </p>
            )}
          </div>
          <DueDateForm
            caseId={onboardingCase.id}
            dueDate={toDateInputValue(onboardingCase.mandatoryMaterialDueDate)}
            canEdit={canMarkOnboardingTraining(session) && !isCancelled}
          />

          <div className="rounded-lg border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  assetsComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {assetsComplete ? "✓" : "—"}
              </span>
              <span className="text-sm text-slate-900">{t("onboarding.assetsComplete")}</span>
              <span className="text-xs text-slate-400">(berdasarkan status penguasaan aset karyawan)</span>
            </div>
            {assetCustodies.length > 0 && (
              <ul className="mt-2 space-y-1 pl-7 text-xs text-slate-500">
                {assetCustodies.map((c) => (
                  <li key={c.id}>
                    {c.asset.assetName} ({c.asset.assetCode}) — {t(`assetCustodyStatus.${c.status}`)}
                  </li>
                ))}
              </ul>
            )}
            {canAssignAssets && (
              <AssignAssetDuringOnboardingForm
                caseId={onboardingCase.id}
                employeeId={onboardingCase.employeeId}
                assets={availableAssets.map((a) => ({
                  id: a.id,
                  label: `${a.assetCode} — ${a.assetName}`,
                  trackingType: a.trackingType,
                  availableQuantity: a.availableQuantity,
                }))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

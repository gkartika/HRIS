"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { createOnboardingCase } from "@/lib/onboarding-create";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { redirect } from "next/navigation";
import { canCreateOnboardingCase, canMarkOnboardingContract, canMarkOnboardingTraining, canManageAssets } from "@/lib/permissions";
import {
  isOnboardingFullyComplete,
  isOnboardingTrainingComplete,
  isOnboardingAssetsComplete,
  canCancelOnboardingCase,
  canReopenOnboardingCase,
} from "@/lib/onboarding";
import { getOnboardingTrainingStatusesForEmployee } from "@/lib/mandatory-training";
import { logAudit } from "@/lib/audit";
import { assignAssetToEmployee } from "@/app/(app)/assets/actions";

// Manual entry point — every other Onboarding Case is auto-created inside
// createEmployee/createEmployeeFromRecruitmentRequest (LIF-03). This covers
// an existing Employee who never got one (legacy/imported data, or a case
// that predates this app). OnboardingCase.employeeId is @unique, so the DB
// itself is the final guard against a duplicate — checked here first too,
// for a clean error message instead of a raw constraint failure.
export async function createOnboardingCaseManually(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateOnboardingCase(session)) return t("common.forbidden");

  const employeeId = formData.get("employeeId") as string;
  const plannedStartDate = formData.get("plannedStartDate") as string;
  if (!employeeId || !plannedStartDate) return "Karyawan dan tanggal mulai wajib diisi.";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const existing = await prisma.onboardingCase.findUnique({ where: { employeeId } });
  if (existing) return `Karyawan ini sudah memiliki kasus Onboarding (${existing.caseNumber}).`;

  const plannedStartDateObj = new Date(plannedStartDate);
  const onboardingCase = await createOnboardingCase(employeeId, plannedStartDateObj);

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "OnboardingCase",
    recordId: onboardingCase.id,
    reason: `Manually created onboarding case ${onboardingCase.caseNumber} for employee ${employeeId}`,
  });

  revalidatePath("/onboarding");
  redirect(`/onboarding/${onboardingCase.id}`);
}

// "Materi Wajib" and "Perlengkapan" are no longer flags this function
// toggles — both are derived live from real data (onboarding-required
// LearningAssignment completion, AssetCustody status), so the overall
// completedAt recompute below re-fetches their current values fresh every
// time the contract flag changes, rather than trusting a stored boolean
// that could go stale the moment a course completes or an asset gets
// assigned outside this page.
export async function toggleContractComplete(caseId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canMarkOnboardingContract(session)) return t("common.forbidden");

  const onboardingCase = await prisma.onboardingCase.findUnique({
    where: { id: caseId },
    include: { employee: { select: { currentPositionId: true } } },
  });
  if (!onboardingCase) return "Kasus onboarding tidak ditemukan.";
  if (onboardingCase.cancelledAt) return "Kasus ini dibatalkan. Buka kembali dahulu untuk mengubahnya.";

  const nextValue = !onboardingCase.contractComplete;
  const [trainingAssignments, assetCustodies] = await Promise.all([
    getOnboardingTrainingStatusesForEmployee(onboardingCase.employeeId),
    prisma.assetCustody.findMany({ where: { employeeId: onboardingCase.employeeId }, select: { status: true } }),
  ]);
  const trainingComplete = isOnboardingTrainingComplete(
    trainingAssignments.map((a) => a.status),
    !!onboardingCase.employee.currentPositionId
  );
  const assetsComplete = isOnboardingAssetsComplete(assetCustodies.map((c) => c.status));
  const nowComplete = isOnboardingFullyComplete(nextValue, trainingComplete, assetsComplete);

  await prisma.onboardingCase.update({
    where: { id: caseId },
    data: {
      contractComplete: nextValue,
      contractCompletedAt: nextValue ? new Date() : null,
      contractCompletedByAccountId: nextValue ? session.user.id : null,
      completedAt: nowComplete ? new Date() : null,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OnboardingCase",
    recordId: caseId,
    reason: `Kontrak ${nextValue ? "marked complete" : "marked incomplete"} for ${onboardingCase.caseNumber}`,
  });

  revalidatePath(`/onboarding/${caseId}`);
  revalidatePath("/onboarding");
}

// Cancel a case that no longer applies: a no-show, a hire entered by mistake,
// or someone who left during onboarding. The case is kept (never deleted) and
// can be reopened. Admin SDM only, like creating one.
export async function cancelOnboardingCase(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateOnboardingCase(session)) return t("common.forbidden");

  const onboardingCase = await prisma.onboardingCase.findUnique({ where: { id: caseId } });
  if (!onboardingCase) return "Kasus onboarding tidak ditemukan.";
  if (!canCancelOnboardingCase(onboardingCase)) {
    return "Kasus yang sudah selesai atau sudah dibatalkan tidak dapat dibatalkan.";
  }

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  await prisma.onboardingCase.update({
    where: { id: caseId },
    data: { cancelledAt: new Date(), cancelledByAccountId: session.user.id, cancellationReason },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OnboardingCase",
    recordId: caseId,
    reason: `${onboardingCase.caseNumber} cancelled: ${cancellationReason}`,
  });

  revalidatePath(`/onboarding/${caseId}`);
  revalidatePath("/onboarding");
}

export async function reopenOnboardingCase(caseId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateOnboardingCase(session)) return t("common.forbidden");

  const onboardingCase = await prisma.onboardingCase.findUnique({ where: { id: caseId } });
  if (!onboardingCase) return "Kasus onboarding tidak ditemukan.";
  if (!canReopenOnboardingCase(onboardingCase)) return "Kasus ini tidak sedang dibatalkan.";

  await prisma.onboardingCase.update({
    where: { id: caseId },
    data: { cancelledAt: null, cancelledByAccountId: null, cancellationReason: null },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OnboardingCase",
    recordId: caseId,
    reason: `${onboardingCase.caseNumber} reopened (was cancelled: ${onboardingCase.cancellationReason ?? "-"})`,
  });

  revalidatePath(`/onboarding/${caseId}`);
  revalidatePath("/onboarding");
}

// The planned start date normally follows the employee's hire date (see
// employees/actions.ts); this is for the rare case where the first day moves
// without the hire date changing.
export async function updateOnboardingPlannedStartDate(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateOnboardingCase(session)) return t("common.forbidden");

  const onboardingCase = await prisma.onboardingCase.findUnique({ where: { id: caseId } });
  if (!onboardingCase) return "Kasus onboarding tidak ditemukan.";
  if (onboardingCase.cancelledAt) return "Kasus ini dibatalkan. Buka kembali dahulu untuk mengubahnya.";

  const plannedStartDate = formData.get("plannedStartDate") as string;
  if (!plannedStartDate || Number.isNaN(Date.parse(plannedStartDate))) return "Tanggal mulai tidak valid.";

  await prisma.onboardingCase.update({ where: { id: caseId }, data: { plannedStartDate: new Date(plannedStartDate) } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OnboardingCase",
    recordId: caseId,
    reason: `${onboardingCase.caseNumber}: planned start date changed to ${plannedStartDate}`,
  });

  revalidatePath(`/onboarding/${caseId}`);
  revalidatePath("/onboarding");
}

export async function updateMandatoryMaterialDueDate(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canMarkOnboardingTraining(session)) return t("common.forbidden");

  const dueDate = (formData.get("mandatoryMaterialDueDate") as string) || null;
  await prisma.onboardingCase.update({
    where: { id: caseId },
    data: { mandatoryMaterialDueDate: dueDate ? new Date(dueDate) : null },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OnboardingCase",
    recordId: caseId,
    reason: `Updated mandatory material due date to ${dueDate ?? "none"}`,
  });

  revalidatePath(`/onboarding/${caseId}`);
}

// Lets GA Admin assign an asset to the new employee directly from the
// Onboarding case, instead of navigating away to /assets — reuses the real
// Phase 4A assignAssetToEmployee action (createCustody) unmodified, then
// additionally revalidates this onboarding case's own path so the derived
// "Perlengkapan Selesai" section reflects the new custody immediately.
export async function assignAssetDuringOnboarding(
  caseId: string,
  assetId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssets(session)) return t("common.forbidden");

  const error = await assignAssetToEmployee(assetId, undefined, formData);
  if (error) return error;

  revalidatePath(`/onboarding/${caseId}`);
  return undefined;
}

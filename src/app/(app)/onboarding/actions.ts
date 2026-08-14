"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { redirect } from "next/navigation";
import { canCreateOnboardingCase, canMarkOnboardingContract, canMarkOnboardingTraining } from "@/lib/permissions";
import {
  isOnboardingFullyComplete,
  isOnboardingTrainingComplete,
  isOnboardingAssetsComplete,
  formatOnboardingCaseNumber,
} from "@/lib/onboarding";
import { getOnboardingTrainingStatusesForEmployee } from "@/lib/mandatory-training";
import { logAudit } from "@/lib/audit";

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
  if (!canCreateOnboardingCase(session)) return "Anda tidak memiliki akses.";

  const employeeId = formData.get("employeeId") as string;
  const plannedStartDate = formData.get("plannedStartDate") as string;
  if (!employeeId || !plannedStartDate) return "Karyawan dan tanggal mulai wajib diisi.";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const existing = await prisma.onboardingCase.findUnique({ where: { employeeId } });
  if (existing) return `Karyawan ini sudah memiliki kasus Onboarding (${existing.caseNumber}).`;

  const plannedStartDateObj = new Date(plannedStartDate);
  const year = plannedStartDateObj.getFullYear();
  const countThisYear = await prisma.onboardingCase.count({
    where: { caseNumber: { startsWith: `ONB-${year}-` } },
  });
  const onboardingCase = await prisma.onboardingCase.create({
    data: {
      caseNumber: formatOnboardingCaseNumber(countThisYear + 1, year),
      employeeId,
      plannedStartDate: plannedStartDateObj,
    },
  });

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
  if (!canMarkOnboardingContract(session)) return "Anda tidak memiliki akses.";

  const onboardingCase = await prisma.onboardingCase.findUnique({ where: { id: caseId } });
  if (!onboardingCase) return "Kasus onboarding tidak ditemukan.";

  const nextValue = !onboardingCase.contractComplete;
  const [trainingAssignments, assetCustodies] = await Promise.all([
    getOnboardingTrainingStatusesForEmployee(onboardingCase.employeeId),
    prisma.assetCustody.findMany({ where: { employeeId: onboardingCase.employeeId }, select: { status: true } }),
  ]);
  const trainingComplete = isOnboardingTrainingComplete(trainingAssignments.map((a) => a.status));
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

export async function updateMandatoryMaterialDueDate(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canMarkOnboardingTraining(session)) return "Anda tidak memiliki akses.";

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

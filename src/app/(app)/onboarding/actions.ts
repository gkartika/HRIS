"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { redirect } from "next/navigation";
import {
  canCreateOnboardingCase,
  canMarkOnboardingContract,
  canMarkOnboardingTraining,
  canMarkOnboardingAssets,
} from "@/lib/permissions";
import { isOnboardingFullyComplete, formatOnboardingCaseNumber } from "@/lib/onboarding";
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

type OnboardingFlag = "contractComplete" | "mandatoryMaterialComplete" | "assetsComplete";

async function toggleOnboardingFlag(
  caseId: string,
  flag: OnboardingFlag,
  completedAtField: "contractCompletedAt" | "mandatoryMaterialCompletedAt" | "assetsCompletedAt",
  completedByField: "contractCompletedByAccountId" | "mandatoryMaterialCompletedByAccountId" | "assetsCompletedByAccountId",
  accountId: string,
  label: string
): Promise<string | undefined> {
  const onboardingCase = await prisma.onboardingCase.findUnique({ where: { id: caseId } });
  if (!onboardingCase) return "Kasus onboarding tidak ditemukan.";

  const nextValue = !onboardingCase[flag];
  const flags = {
    contractComplete: onboardingCase.contractComplete,
    mandatoryMaterialComplete: onboardingCase.mandatoryMaterialComplete,
    assetsComplete: onboardingCase.assetsComplete,
    [flag]: nextValue,
  };
  const nowComplete = isOnboardingFullyComplete(
    flags.contractComplete,
    flags.mandatoryMaterialComplete,
    flags.assetsComplete
  );

  await prisma.onboardingCase.update({
    where: { id: caseId },
    data: {
      [flag]: nextValue,
      [completedAtField]: nextValue ? new Date() : null,
      [completedByField]: nextValue ? accountId : null,
      completedAt: nowComplete ? new Date() : null,
    },
  });

  await logAudit({
    actorAccountId: accountId,
    action: "UPDATE",
    datasetName: "OnboardingCase",
    recordId: caseId,
    reason: `${label} ${nextValue ? "marked complete" : "marked incomplete"} for ${onboardingCase.caseNumber}`,
  });

  revalidatePath(`/onboarding/${caseId}`);
  revalidatePath("/onboarding");
}

export async function toggleContractComplete(caseId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canMarkOnboardingContract(session)) return "Anda tidak memiliki akses.";
  return toggleOnboardingFlag(
    caseId,
    "contractComplete",
    "contractCompletedAt",
    "contractCompletedByAccountId",
    session.user.id,
    "Kontrak"
  );
}

export async function toggleTrainingComplete(caseId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canMarkOnboardingTraining(session)) return "Anda tidak memiliki akses.";
  return toggleOnboardingFlag(
    caseId,
    "mandatoryMaterialComplete",
    "mandatoryMaterialCompletedAt",
    "mandatoryMaterialCompletedByAccountId",
    session.user.id,
    "Materi wajib"
  );
}

export async function toggleAssetsComplete(caseId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canMarkOnboardingAssets(session)) return "Anda tidak memiliki akses.";
  return toggleOnboardingFlag(
    caseId,
    "assetsComplete",
    "assetsCompletedAt",
    "assetsCompletedByAccountId",
    session.user.id,
    "Perlengkapan"
  );
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

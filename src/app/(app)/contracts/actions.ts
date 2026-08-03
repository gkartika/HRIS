"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canManageContracts,
  canSubmitContractRecommendation,
  canDecideContractRenewal,
  canSignContract,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { logAudit } from "@/lib/audit";
import {
  canStartContractReview,
  canSubmitContractRecommendation as canSubmitRecommendationStatus,
  canDecideContractRenewal as canDecideRenewalStatus,
  canCreateRenewalDraft,
  canReleaseContract,
  canSignContractStatus,
  canActivateContract,
} from "@/lib/contract";
import { nextContractNumber, createRenewalDraftContract } from "@/lib/contract-mutations";
import type { EmploymentStatus, ContractRenewalRecommendation } from "@/generated/prisma/enums";

// HR Admin establishes a baseline Contract for an existing Employee — goes
// straight to ACTIVE since there's no renewal process for a brand-new
// contract entry (only a renewal of an existing one goes through the
// Draft/Released/Signed pipeline).
export async function createContract(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return "Anda tidak memiliki akses.";

  const contractType = formData.get("contractType") as EmploymentStatus;
  const startDate = formData.get("startDate") as string;
  const endDate = (formData.get("endDate") as string) || null;

  if (!contractType || !startDate) return "Jenis kontrak dan tanggal mulai wajib diisi.";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const contractNumber = await nextContractNumber(contractType);
  const contract = await prisma.contract.create({
    data: {
      contractNumber,
      employeeId,
      contractType,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: "ACTIVE",
      activatedAt: new Date(),
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Contract",
    recordId: contract.id,
    reason: `Created baseline contract ${contractNumber} for employee ${employeeId}`,
  });

  revalidatePath(`/contracts/${contract.id}`);
  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}`);
}

export async function startContractReview(contractId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return "Anda tidak memiliki akses.";

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (!canStartContractReview(contract.status)) return "Kontrak ini tidak dalam status Aktif.";

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "REVIEW_REQUESTED", reviewRequestedAt: new Date() },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Contract",
    recordId: contractId,
    reason: `Started renewal review for ${contract.contractNumber}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

export async function submitContractRecommendation(
  contractId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (!canSubmitRecommendationStatus(contract.status)) return "Kontrak ini belum memasuki masa tinjauan.";

  const recommendationByEmployeeId =
    (formData.get("recommendationByEmployeeId") as string) || session.user.employeeId;
  const recommendation = formData.get("recommendation") as ContractRenewalRecommendation;
  const recommendationNote = (formData.get("recommendationNote") as string)?.trim() || null;

  if (!recommendationByEmployeeId || !recommendation) {
    return "Pemberi rekomendasi dan rekomendasi wajib diisi.";
  }

  const isManager = await isDirectManagerOfEmployee(session.user.employeeId, contract.employeeId);
  if (!canSubmitContractRecommendation(session, isManager)) return "Anda tidak memiliki akses.";

  const recommender = await prisma.employee.findUnique({ where: { id: recommendationByEmployeeId } });
  if (!recommender) return "Karyawan pemberi rekomendasi tidak ditemukan.";

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "RECOMMENDATION_SUBMITTED",
      recommendationSubmittedAt: new Date(),
      recommendationByEmployeeId,
      recommendationByPositionId: recommender.currentPositionId,
      recommendation,
      recommendationNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Contract",
    recordId: contractId,
    reason: `Recommendation (${recommendation}) submitted for ${contract.contractNumber}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

export async function decideContractRenewal(
  contractId: string,
  decision: "RENEW" | "NOT_RENEW",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canDecideContractRenewal(hrManagerPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya HR Manager aktif yang dapat memutuskan.";
  }

  const decisionPositionId = formData.get("decisionPositionId") as string;
  if (!hrManagerPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi HR Manager yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (!canDecideRenewalStatus(contract.status)) return "Kontrak ini belum memiliki rekomendasi untuk diputuskan.";

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if (decision === "NOT_RENEW" && !decisionNote) return "Alasan wajib diisi untuk Tidak Diperpanjang.";

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: decision === "RENEW" ? "APPROVED_FOR_RENEWAL" : "NOT_RENEWED",
      decisionAt: new Date(),
      decisionByAccountId: session.user.id,
      decisionPositionId,
      decisionNote,
      notRenewedReason: decision === "NOT_RENEW" ? decisionNote : null,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "RENEW" ? "APPROVE" : "REJECT",
    datasetName: "Contract",
    recordId: contractId,
    reason: decisionNote ?? `Contract ${contract.contractNumber} ${decision}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

export async function createRenewalDraft(
  contractId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return "Anda tidak memiliki akses.";

  const oldContract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!oldContract) return "Kontrak tidak ditemukan.";
  if (!canCreateRenewalDraft(oldContract.status)) return "Kontrak ini belum disetujui untuk diperpanjang.";

  const contractType = formData.get("contractType") as EmploymentStatus;
  const startDate = formData.get("startDate") as string;
  const endDate = (formData.get("endDate") as string) || null;
  if (!contractType || !startDate) return "Jenis kontrak dan tanggal mulai wajib diisi.";

  const newContract = await createRenewalDraftContract({
    oldContractId: oldContract.id,
    employeeId: oldContract.employeeId,
    contractType,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    actorAccountId: session.user.id,
    buildAuditReason: (contractNumber) => `Drafted renewal ${contractNumber} for ${oldContract.contractNumber}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${newContract.id}`);
  revalidatePath("/contracts");
  redirect(`/contracts/${newContract.id}`);
}

export async function releaseContract(contractId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return "Anda tidak memiliki akses.";

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (!canReleaseContract(contract.status)) return "Kontrak ini belum berstatus Draf.";

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "RELEASED", releasedAt: new Date() },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "RELEASE",
    datasetName: "Contract",
    recordId: contractId,
    reason: `Released ${contract.contractNumber} to employee`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

export async function signContract(contractId: string): Promise<string | undefined> {
  const session = await requireSession();

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (!canSignContract(session, contract.employeeId)) return "Anda tidak memiliki akses.";
  if (!canSignContractStatus(contract.status)) return "Kontrak ini belum dirilis.";

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "SIGNED", signedAt: new Date() },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Contract",
    recordId: contractId,
    reason: `Employee signed ${contract.contractNumber}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

// WF-10's final step: the new Contract becomes Active; the old one it
// renews (if any) flips to Ended — "old/new history remains" (WF-12), never
// overwritten. Employee.employmentStatus is synced to match, same as
// currentPositionId is synced by Assignment changes.
export async function activateContract(contractId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return "Anda tidak memiliki akses.";

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (!canActivateContract(contract.status)) return "Kontrak ini belum ditandatangani.";

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });
    if (contract.renewedFromContractId) {
      await tx.contract.update({
        where: { id: contract.renewedFromContractId },
        data: { status: "ENDED" },
      });
    }
    await tx.employee.update({
      where: { id: contract.employeeId },
      data: { employmentStatus: contract.contractType },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Contract",
    recordId: contractId,
    reason: `Activated ${contract.contractNumber}${contract.renewedFromContractId ? ` (superseded ${contract.renewedFromContractId})` : ""}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  revalidatePath(`/employees/${contract.employeeId}`);
  if (contract.renewedFromContractId) revalidatePath(`/contracts/${contract.renewedFromContractId}`);
}

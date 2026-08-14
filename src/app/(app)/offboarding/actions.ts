"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canReportResignation,
  canDecideOffboardingCaseAsDeptHead,
  canDecideOffboardingCase,
  canExecuteExitClearance,
  canCancelOffboardingCase,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { logAudit } from "@/lib/audit";
import { syncPositionStatus } from "@/lib/position-occupancy";
import {
  formatOffboardingCaseNumber,
  initialOffboardingCaseStatus,
  canDecideOffboardingCaseAsDeptHeadStatus,
  canDecideOffboardingCaseStatus,
  canExecuteExitClearanceStatus,
  canCancelOffboardingCaseStatus,
} from "@/lib/offboarding";
import type { OffboardingReason } from "@/generated/prisma/enums";
import { blocksOffboarding } from "@/lib/assets";

// LIF-06/12: the ONE shared creator for every trigger — a reported
// resignation and Contract Renewal's non-renewal handoff (contracts/
// renewal-actions.ts's createOffboardingHandoff) both call this directly
// (server-to-server), same "one internal creator, no duplicated insert"
// pattern as evaluations/actions.ts's createDraftEvaluation.
export async function createOffboardingCaseInternal(params: {
  employeeId: string;
  reason: OffboardingReason;
  lastWorkingDay: Date;
  reportedByAccountId: string | null;
  managerNote?: string | null;
  sourceRenewalCaseId?: string | null;
}): Promise<{ id: string; caseNumber: string }> {
  const year = new Date().getFullYear();
  const countThisYear = await prisma.offboardingCase.count({
    where: { caseNumber: { startsWith: `OFB-${year}-` } },
  });
  const caseNumber = formatOffboardingCaseNumber(countThisYear + 1, year);

  const created = await prisma.offboardingCase.create({
    data: {
      caseNumber,
      employeeId: params.employeeId,
      reason: params.reason,
      status: initialOffboardingCaseStatus(params.reason),
      lastWorkingDay: params.lastWorkingDay,
      // Documented simplification (no explicit day-count rule exists for
      // offboarding, unlike Evaluation's WF-18 "5 working days") — clearance
      // is due by the last working day itself.
      clearanceDueDate: params.lastWorkingDay,
      reportedByAccountId: params.reportedByAccountId,
      managerNote: params.managerNote ?? null,
      sourceRenewalCaseId: params.sourceRenewalCaseId ?? null,
    },
  });

  await logAudit({
    actorAccountId: params.reportedByAccountId,
    action: "CREATE",
    datasetName: "OffboardingCase",
    recordId: created.id,
    reason: `${caseNumber} reported (reason: ${params.reason})`,
  });

  return { id: created.id, caseNumber: created.caseNumber };
}

export async function reportResignation(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const employeeId = formData.get("employeeId") as string;
  const lastWorkingDay = formData.get("lastWorkingDay") as string;
  const managerNote = (formData.get("managerNote") as string)?.trim() || null;

  if (!employeeId || !lastWorkingDay) {
    return "Karyawan dan Hari Kerja Terakhir wajib diisi.";
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const isEmployeesManager = await isDirectManagerOfEmployee(session.user.employeeId, employeeId);
  if (!canReportResignation(session, isEmployeesManager)) {
    return "Anda tidak memiliki akses. Hanya atasan langsung karyawan ini atau Admin SDM yang dapat melaporkan pengunduran diri.";
  }

  const existingActiveCase = await prisma.offboardingCase.findFirst({
    where: { employeeId, status: { in: ["PENDING_DEPT_HEAD", "PENDING_HR_MANAGER", "PENDING_CLEARANCE"] } },
  });
  if (existingActiveCase) {
    return `Karyawan ini sudah memiliki kasus Offboarding aktif (${existingActiveCase.caseNumber}).`;
  }

  const created = await createOffboardingCaseInternal({
    employeeId,
    reason: "RESIGNATION",
    lastWorkingDay: new Date(lastWorkingDay),
    reportedByAccountId: session.user.id,
    managerNote,
  });

  revalidatePath("/offboarding");
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/offboarding/${created.id}`);
}

// Per direct user request: a RESIGNATION case's Dept Head (3B, scoped to
// the employee's own department) approval stage — same "approve only, no
// reject concept" shape as the HR Manager stage below (only cancellation,
// see cancelOffboardingCase, is available as the negative outcome).
export async function decideOffboardingCaseAsDeptHead(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const offboardingCase = await prisma.offboardingCase.findUnique({
    where: { id: caseId },
    include: { employee: { include: { currentPosition: true } } },
  });
  if (!offboardingCase) return "Kasus tidak ditemukan.";
  if (!canDecideOffboardingCaseAsDeptHeadStatus(offboardingCase.status)) {
    return "Kasus ini belum siap untuk diputuskan atau sudah diproses.";
  }

  const departmentId = offboardingCase.employee.currentPosition
    ? await resolveDepartmentId(offboardingCase.employee.currentPosition.orgUnitId)
    : null;
  if (!departmentId) return "Department tidak dapat ditentukan dari Posisi karyawan ini.";

  const deptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, departmentId);
  if (!canDecideOffboardingCaseAsDeptHead(deptHeadPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya Kepala Departemen/Manajer (Level 3B) di department ini yang dapat memutuskan.";
  }

  const decisionPositionId = (formData.get("decisionPositionId") as string) || "";
  if (!deptHeadPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi Kepala Departemen/Manajer yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const deptHeadNote = (formData.get("deptHeadNote") as string)?.trim() || null;

  await prisma.offboardingCase.update({
    where: { id: caseId },
    data: {
      status: "PENDING_HR_MANAGER",
      deptHeadDecisionAt: new Date(),
      deptHeadDecisionByAccountId: session.user.id,
      deptHeadDecisionPositionId: decisionPositionId,
      deptHeadNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "APPROVE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: deptHeadNote ?? `${offboardingCase.caseNumber} approved by dept head/manager`,
  });

  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath("/offboarding");
  revalidatePath("/approvals");
}

// LIF-06: "HR Manager decision/oversight" — a resignation report has one
// real outcome here (approve, moving it to exit-clearance); there is no
// "reject a resignation" concept, only cancellation (see
// cancelOffboardingCase), available separately at either pending stage.
export async function decideOffboardingCase(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canDecideOffboardingCase(hrManagerPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya HR Manager aktif yang dapat memutuskan.";
  }

  const decisionPositionId = (formData.get("decisionPositionId") as string) || "";
  if (!hrManagerPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi HR Manager yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const offboardingCase = await prisma.offboardingCase.findUnique({ where: { id: caseId } });
  if (!offboardingCase) return "Kasus tidak ditemukan.";
  if (!canDecideOffboardingCaseStatus(offboardingCase.status)) {
    return "Kasus ini belum siap untuk diputuskan atau sudah diproses.";
  }

  const hrManagerNote = (formData.get("hrManagerNote") as string)?.trim() || null;

  await prisma.offboardingCase.update({
    where: { id: caseId },
    data: {
      status: "PENDING_CLEARANCE",
      hrManagerDecisionAt: new Date(),
      hrManagerDecisionByAccountId: session.user.id,
      hrManagerDecisionPositionId: decisionPositionId,
      hrManagerNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "APPROVE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: hrManagerNote ?? `${offboardingCase.caseNumber} approved for exit clearance`,
  });

  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath("/offboarding");
  revalidatePath("/approvals");
}

// LIF-06/LIF-07/GA-05: "HR Admin exit-clearance execution > Account
// Disable" — one combined action (nothing in the spec describes an
// intermediate gate between them). Closes (never deletes) every ACTIVE
// Assignment as of the case's last working day, per LIF-07's "does not
// remove historical records." Phase 4A: "Only open Employee custody blocks
// offboarding" is now a real DB-backed check (blocksOffboarding below) —
// Department/Location custody never blocks, matching the workflow spec.
export async function executeExitClearance(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canExecuteExitClearance(session)) return "Anda tidak memiliki akses.";

  const offboardingCase = await prisma.offboardingCase.findUnique({
    where: { id: caseId },
    include: { employee: { include: { account: true } } },
  });
  if (!offboardingCase) return "Kasus tidak ditemukan.";
  if (!canExecuteExitClearanceStatus(offboardingCase.status)) {
    return "Kasus ini belum disetujui atau sudah selesai diproses.";
  }

  const openEmployeeCustodies = await prisma.assetCustody.findMany({
    where: { employeeId: offboardingCase.employeeId, status: { not: "RETURNED" } },
    include: { asset: { select: { assetName: true, assetCode: true } } },
  });
  const blockingCustodies = openEmployeeCustodies.filter((c) => blocksOffboarding("EMPLOYEE", c.status));
  if (blockingCustodies.length > 0) {
    const assetList = blockingCustodies.map((c) => `${c.asset.assetName} (${c.asset.assetCode})`).join(", ");
    return `Clearance keluar diblokir — masih ada aset yang belum dikembalikan: ${assetList}. GA Admin harus memproses pengembalian aset terlebih dahulu.`;
  }

  const clearanceNote = (formData.get("clearanceNote") as string)?.trim() || null;

  const activeAssignments = await prisma.assignment.findMany({
    where: { employeeId: offboardingCase.employeeId, status: "ACTIVE" },
  });

  await prisma.$transaction(async (tx) => {
    for (const assignment of activeAssignments) {
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: "ENDED", effectiveTo: offboardingCase.lastWorkingDay },
      });
    }

    await tx.employee.update({
      where: { id: offboardingCase.employeeId },
      data: { currentPositionId: null, activeFlag: false },
    });

    if (offboardingCase.employee.account) {
      await tx.account.update({
        where: { id: offboardingCase.employee.account.id },
        data: { accountStatus: "DISABLED", accountDisabledAt: new Date() },
      });
    }

    await tx.offboardingCase.update({
      where: { id: caseId },
      data: {
        status: "COMPLETED",
        clearanceCompletedAt: new Date(),
        clearanceCompletedByAccountId: session.user.id,
        clearanceNote,
      },
    });
  });

  for (const assignment of activeAssignments) {
    await syncPositionStatus(assignment.positionId);
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: `${offboardingCase.caseNumber}: exit clearance completed, ${activeAssignments.length} assignment(s) ended${offboardingCase.employee.account ? ", account disabled" : ""}`,
  });

  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath("/offboarding");
  revalidatePath(`/employees/${offboardingCase.employeeId}`);
  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/team");
}

// Same DM-25-style exception as Recruitment/Movement/Contract cancellation
// — available at either pending stage, not just the reporter's own stage.
export async function cancelOffboardingCase(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const offboardingCase = await prisma.offboardingCase.findUnique({ where: { id: caseId } });
  if (!offboardingCase) return "Kasus tidak ditemukan.";

  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (
    !canCancelOffboardingCase(
      session,
      offboardingCase.reportedByAccountId,
      hrManagerPositions.map((p) => p.positionId)
    )
  ) {
    return "Anda tidak memiliki akses untuk membatalkan kasus ini.";
  }
  if (!canCancelOffboardingCaseStatus(offboardingCase.status)) {
    return "Kasus yang sudah selesai atau dibatalkan tidak dapat dibatalkan lagi.";
  }

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  await prisma.offboardingCase.update({
    where: { id: caseId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByAccountId: session.user.id,
      cancellationReason,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OffboardingCase",
    recordId: caseId,
    reason: `${offboardingCase.caseNumber} cancelled: ${cancellationReason}`,
  });

  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath("/offboarding");
  revalidatePath("/approvals");
}

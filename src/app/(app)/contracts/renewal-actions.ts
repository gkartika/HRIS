"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { companyToday, companyYear, DAY_MS } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitRenewalDeptHeadRecommendation,
  canDecideContractRenewalCase,
  canManageContracts,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { isPositionOccupiedByPrimary } from "@/lib/position-occupancy";
import { logAudit } from "@/lib/audit";
import { createRenewalDraftContract, getActivePrimaryAssignment } from "@/lib/contract-mutations";
import { formatMovementRequestNumber, validateProposedPosition, validateJobLevelDirection } from "@/lib/movement";
import { isEvaluationComplete } from "@/lib/evaluation";
import { createDraftEvaluation } from "@/lib/evaluation-create";
import { createOffboardingCaseInternal } from "@/lib/offboarding-create";
import {
  formatRenewalCaseNumber,
  canSubmitDeptHeadRecommendation,
  canDecideRenewalCase,
  requiresLinkedMovement,
  recommendationToMovementType,
  recommendationDurationMonths,
  requiresChangeReason,
} from "@/lib/contract-renewal";
import type { RenewalRecommendation } from "@/generated/prisma/enums";

// Version after UAT: manual per-contract trigger for HR Admin, from the
// dashboard's expiring-contracts widget — same body as one iteration of
// runDueRenewalScan (lib/renewal-scan.ts), minus the isRenewalDue gate, since HR Admin
// is explicitly choosing to start the renewal process early rather than
// waiting for the automatic D-30 trigger. The unique constraint on
// ContractRenewalCase.currentContractId still guards against ever creating
// two cases for the same contract.
export async function triggerRenewalCaseNow(contractId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return t("common.forbidden");

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { employee: true, renewalCaseAsCurrentContract: true },
  });
  if (!contract) return "Kontrak tidak ditemukan.";
  if (contract.status !== "ACTIVE" || !contract.endDate) {
    return "Kontrak ini tidak aktif atau tidak memiliki tanggal berakhir.";
  }
  if (contract.renewalCaseAsCurrentContract) {
    return "Proses Perpanjangan untuk kontrak ini sudah dimulai.";
  }

  const employee = contract.employee;
  if (!employee.currentPositionId) return "Karyawan ini belum memiliki Posisi saat ini.";

  const primaryAssignment = await prisma.assignment.findFirst({
    where: { employeeId: employee.id, assignmentType: "PRIMARY", status: "ACTIVE" },
  });
  if (!primaryAssignment) return "Penempatan Utama aktif karyawan ini tidak ditemukan.";

  const year = companyYear();
  const seq = await nextSequence(`REN-${year}`);
  const caseNumber = formatRenewalCaseNumber(seq, year);

  const evaluation = await createDraftEvaluation({
    employeeId: employee.id,
    purpose: "CONTRACT_RENEWAL",
    primaryAssignmentId: primaryAssignment.id,
    snapshotPositionId: employee.currentPositionId,
    createdByAccountId: session.user.id,
  });

  const created = await prisma.contractRenewalCase.create({
    data: {
      caseNumber,
      currentContractId: contract.id,
      employeeId: employee.id,
      primaryAssignmentId: primaryAssignment.id,
      snapshotPositionId: employee.currentPositionId,
      status: "TRIGGERED",
      evaluationId: evaluation.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ContractRenewalCase",
    recordId: created.id,
    reason: `Manually triggered by HR Admin from dashboard for contract ${contract.contractNumber}, linked to ${evaluation.evaluationNumber}`,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

export async function submitDeptHeadRecommendation(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const renewalCase = await prisma.contractRenewalCase.findUnique({
    where: { id: caseId },
    include: { employee: { include: { currentPosition: true } }, currentContract: true, evaluation: true },
  });
  if (!renewalCase) return "Kasus tidak ditemukan.";

  if (!renewalCase.employee.currentPosition || !renewalCase.employee.currentPositionId) {
    return "Karyawan ini belum memiliki Posisi saat ini.";
  }

  const departmentId = await resolveDepartmentId(renewalCase.employee.currentPosition.orgUnitId);
  if (!departmentId) return "Department tidak dapat ditentukan dari Posisi karyawan ini.";

  const deptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, departmentId);
  if (!canSubmitRenewalDeptHeadRecommendation(deptHeadPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya Kepala Departemen/Manajer (Level 3B) di department ini yang dapat memberikan rekomendasi.";
  }
  if (!canSubmitDeptHeadRecommendation(renewalCase.status) || !isEvaluationComplete(renewalCase.evaluation?.status ?? "DRAFT")) {
    return "Evaluasi FR-HC-01-07 (P1 dan P2) harus selesai terlebih dahulu.";
  }

  const decisionPositionId = (formData.get("decisionPositionId") as string) || "";
  if (!deptHeadPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi Kepala Departemen/Manajer yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const recommendation = formData.get("recommendation") as RenewalRecommendation;
  const note = (formData.get("deptHeadNote") as string)?.trim() || null;
  if (!recommendation) return "Rekomendasi wajib dipilih.";
  if (recommendation === "TIDAK_DIPERPANJANG" && !note) {
    return "Catatan wajib diisi untuk Tidak Diperpanjang.";
  }

  let proposedPositionId: string | null = null;
  const durationMonths = recommendationDurationMonths(recommendation);

  if (requiresLinkedMovement(recommendation)) {
    proposedPositionId = (formData.get("proposedPositionId") as string) || null;
    if (!proposedPositionId) return "Posisi yang diusulkan wajib dipilih untuk Mutasi/Demosi.";

    const currentPositionId = renewalCase.employee.currentPositionId;
    const movementType = recommendationToMovementType(recommendation)!;
    const positionError = validateProposedPosition(movementType, currentPositionId, proposedPositionId);
    if (positionError) return positionError;

    const [currentPosition, proposedPosition] = await Promise.all([
      prisma.position.findUnique({ where: { id: currentPositionId }, include: { job: true } }),
      prisma.position.findUnique({ where: { id: proposedPositionId }, include: { job: true } }),
    ]);
    if (!currentPosition || !proposedPosition) return "Posisi tidak ditemukan.";

    const levelError = validateJobLevelDirection(movementType, currentPosition.jobLevel, proposedPosition.jobLevel);
    if (levelError) return levelError;

    if (await isPositionOccupiedByPrimary(proposedPositionId, renewalCase.employeeId)) {
      return "Posisi yang diusulkan sudah memiliki pemegang Utama aktif — pilih posisi lain.";
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let linkedMovementRequestId: string | null = null;

    if (requiresLinkedMovement(recommendation)) {
      const movementType = recommendationToMovementType(recommendation)!;
      const currentAssignment = await tx.assignment.findFirst({
        where: { employeeId: renewalCase.employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
      });
      if (!currentAssignment) return { error: "Assignment Utama aktif karyawan ini tidak ditemukan." };

      const year = companyYear();
      const seq = await nextSequence(`MOV-${year}`, tx);
      const requestNumber = formatMovementRequestNumber(seq, year);

      const proposedEffectiveDate = renewalCase.currentContract.endDate
        ? new Date(renewalCase.currentContract.endDate.getTime() + DAY_MS)
        : companyToday();

      const movement = await tx.movementRequest.create({
        data: {
          requestNumber,
          employeeId: renewalCase.employeeId,
          movementType,
          currentPositionId: renewalCase.employee.currentPositionId!,
          currentAssignmentId: currentAssignment.id,
          proposedPositionId: proposedPositionId!,
          proposedEffectiveDate,
          requestReason: `Rekomendasi ${movementType === "MUTATION" ? "Mutasi" : "Demosi"} dari Kepala Departemen/Manajer sebagai bagian dari proses Perpanjangan Kontrak ${renewalCase.caseNumber}.`,
          status: "SUBMITTED",
          requesterEmployeeId: session.user.employeeId!,
          requesterPositionId: decisionPositionId,
          submittedByAccountId: session.user.id,
          // LIF-13: reuse the renewal's already-completed Evaluation — never
          // create a second one for the linked Perubahan Posisi draft.
          evaluationId: renewalCase.evaluationId,
          deptHeadDecisionAt: new Date(),
          deptHeadDecisionByAccountId: session.user.id,
          deptHeadDecisionPositionId: decisionPositionId,
          deptHeadDecisionNote:
            "Direkomendasikan otomatis melalui proses Perpanjangan Kontrak — rekomendasi Kepala Departemen/Manajer ini dihitung sebagai persetujuan tahap ini (DEC-019).",
        },
      });
      linkedMovementRequestId = movement.id;
    }

    const updated = await tx.contractRenewalCase.update({
      where: { id: caseId },
      data: {
        status: "PENDING_HR_MANAGER",
        deptHeadEmployeeId: session.user.employeeId,
        deptHeadPositionId: decisionPositionId,
        deptHeadRecommendedAt: new Date(),
        deptHeadRecommendation: recommendation,
        deptHeadProposedDurationMonths: durationMonths,
        deptHeadProposedPositionId: proposedPositionId,
        deptHeadNote: note,
        linkedMovementRequestId,
      },
    });
    return { updated };
  });

  if ("error" in result) return result.error;

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ContractRenewalCase",
    recordId: caseId,
    reason: `Dept Head recommendation (${recommendation}) submitted for ${renewalCase.caseNumber}`,
  });

  revalidatePath(`/contracts/${renewalCase.currentContractId}`);
  revalidatePath("/contracts");
  revalidatePath("/movements");
}

// WF-12/ACC-16/DEC-019: the HR Manager's single combined decision — updates
// the renewal case AND its linked Perubahan Posisi draft (if any) together
// in one transaction, rather than two separate approvals.
export async function decideRenewalCase(
  caseId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canDecideContractRenewalCase(hrManagerPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya HR Manager aktif yang dapat memutuskan.";
  }

  const decisionPositionId = (formData.get("decisionPositionId") as string) || "";
  if (!hrManagerPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi HR Manager yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const renewalCase = await prisma.contractRenewalCase.findUnique({
    where: { id: caseId },
    include: { currentContract: true, linkedMovementRequest: true, employee: { include: { currentPosition: true } } },
  });
  if (!renewalCase) return "Kasus tidak ditemukan.";
  if (!canDecideRenewalCase(renewalCase.status)) return "Kasus ini belum siap untuk diputuskan atau sudah diproses.";

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if ((decision === "REJECTED" || decision === "RETURNED") && !decisionNote) {
    return "Catatan keputusan wajib diisi untuk Tolak/Kembalikan.";
  }

  const finalRecommendationInput = (formData.get("finalRecommendation") as RenewalRecommendation) || null;
  const finalRecommendation: RenewalRecommendation | null =
    decision === "APPROVED" ? finalRecommendationInput ?? renewalCase.deptHeadRecommendation : null;
  if (decision === "APPROVED" && !finalRecommendation) return "Rekomendasi akhir wajib dipilih.";

  const changeReason = (formData.get("changeReason") as string)?.trim() || null;
  if (
    decision === "APPROVED" &&
    finalRecommendation &&
    requiresChangeReason(renewalCase.deptHeadRecommendation, finalRecommendation) &&
    !changeReason
  ) {
    return "Alasan perubahan wajib diisi karena rekomendasi akhir berbeda dari rekomendasi Kepala Departemen/Manajer.";
  }

  let newProposedPositionId: string | null = null;
  if (decision === "APPROVED" && finalRecommendation && requiresLinkedMovement(finalRecommendation)) {
    newProposedPositionId = (formData.get("proposedPositionId") as string) || renewalCase.deptHeadProposedPositionId;
    if (!newProposedPositionId) return "Posisi yang diusulkan wajib dipilih untuk Mutasi/Demosi.";

    const currentPositionId = renewalCase.employee.currentPositionId;
    if (!currentPositionId) return "Karyawan ini belum memiliki Posisi saat ini.";
    const movementType = recommendationToMovementType(finalRecommendation)!;
    const positionError = validateProposedPosition(movementType, currentPositionId, newProposedPositionId);
    if (positionError) return positionError;
    if (await isPositionOccupiedByPrimary(newProposedPositionId, renewalCase.employeeId)) {
      return "Posisi yang diusulkan sudah memiliki pemegang Utama aktif — pilih posisi lain.";
    }
  }

  const movementStatus = decision; // "APPROVED" | "REJECTED" | "RETURNED" — identical value set on MovementRequestStatus.

  const result = await prisma.$transaction(async (tx) => {
    let linkedMovementRequestId = renewalCase.linkedMovementRequestId;

    if (decision === "APPROVED" && finalRecommendation && requiresLinkedMovement(finalRecommendation)) {
      const movementType = recommendationToMovementType(finalRecommendation)!;

      if (renewalCase.linkedMovementRequest) {
        // Reuse the existing draft, updating its target if the HR Manager
        // changed it (WF-12: "update the linked draft before the decision").
        await tx.movementRequest.update({
          where: { id: renewalCase.linkedMovementRequest.id },
          data: {
            movementType,
            proposedPositionId: newProposedPositionId!,
            status: "APPROVED",
            decisionAt: new Date(),
            decisionByAccountId: session.user.id,
            decisionPositionId,
            decisionNote: changeReason ?? decisionNote,
          },
        });
      } else {
        // The Dept Head never recommended Mutasi/Demosi — the HR Manager is
        // introducing it here. No real Dept Head approval exists to
        // attribute, so the Dept-Head-decision evidence is recorded as the
        // HR Manager's own combined decision, clearly noted as such (a
        // documented exception — see docs/DECISIONS.md).
        const currentAssignment = await tx.assignment.findFirst({
          where: { employeeId: renewalCase.employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
        });
        if (!currentAssignment) return { error: "Assignment Utama aktif karyawan ini tidak ditemukan." };

        const year = companyYear();
        const seq = await nextSequence(`MOV-${year}`, tx);
        const requestNumber = formatMovementRequestNumber(seq, year);
        const proposedEffectiveDate = renewalCase.currentContract.endDate
          ? new Date(renewalCase.currentContract.endDate.getTime() + DAY_MS)
          : new Date();

        const created = await tx.movementRequest.create({
          data: {
            requestNumber,
            employeeId: renewalCase.employeeId,
            movementType,
            currentPositionId: renewalCase.employee.currentPositionId!,
            currentAssignmentId: currentAssignment.id,
            proposedPositionId: newProposedPositionId!,
            proposedEffectiveDate,
            requestReason: `Rekomendasi ${movementType === "MUTATION" ? "Mutasi" : "Demosi"} ditetapkan oleh HR Manager sebagai bagian dari proses Perpanjangan Kontrak ${renewalCase.caseNumber}.`,
            status: "APPROVED",
            requesterEmployeeId: session.user.employeeId!,
            requesterPositionId: decisionPositionId,
            submittedByAccountId: session.user.id,
            evaluationId: renewalCase.evaluationId,
            deptHeadDecisionAt: new Date(),
            deptHeadDecisionByAccountId: session.user.id,
            deptHeadDecisionPositionId: decisionPositionId,
            deptHeadDecisionNote: "Ditetapkan oleh HR Manager melalui keputusan gabungan — tidak ada rekomendasi Mutasi/Demosi asli dari Kepala Departemen/Manajer untuk kasus ini.",
            decisionAt: new Date(),
            decisionByAccountId: session.user.id,
            decisionPositionId,
            decisionNote: changeReason,
          },
        });
        linkedMovementRequestId = created.id;
      }
    } else if (renewalCase.linkedMovementRequest) {
      // Final outcome doesn't need a linked Position change (Perpanjang,
      // Tidak Diperpanjang, or a Reject/Return) but a draft already exists
      // (Dept Head had recommended Mutasi/Demosi) — void it, never delete
      // it (WF-12).
      if (decision === "APPROVED") {
        await tx.movementRequest.update({
          where: { id: renewalCase.linkedMovementRequest.id },
          data: {
            status: "CANCELLED",
            previousStatus: renewalCase.linkedMovementRequest.status,
            cancelledAt: new Date(),
            cancelledByAccountId: session.user.id,
            cancelledByEmployeeId: session.user.employeeId,
            cancellationAuthority: "HR_MANAGER",
            cancellationReason: changeReason ?? "Rekomendasi akhir HR Manager tidak lagi memerlukan Perubahan Posisi ini.",
          },
        });
      } else {
        // Reject/Return the renewal case — mirror the same outcome onto the
        // linked draft in the same action.
        await tx.movementRequest.update({
          where: { id: renewalCase.linkedMovementRequest.id },
          data: {
            status: movementStatus,
            decisionAt: new Date(),
            decisionByAccountId: session.user.id,
            decisionPositionId,
            decisionNote,
          },
        });
      }
    }

    let generatedContractId: string | null = null;
    if (decision === "APPROVED" && finalRecommendation) {
      if (finalRecommendation === "TIDAK_DIPERPANJANG") {
        await tx.contract.update({
          where: { id: renewalCase.currentContractId },
          data: { status: "NOT_RENEWED", notRenewedReason: decisionNote ?? changeReason },
        });
      } else if (!requiresLinkedMovement(finalRecommendation)) {
        // Perpanjang 3/6/12 — no linked Position change, so contract
        // generation isn't gated on anything further; draft it now.
        const durationMonths = recommendationDurationMonths(finalRecommendation)!;
        const startDate = renewalCase.currentContract.endDate
          ? new Date(renewalCase.currentContract.endDate.getTime() + DAY_MS)
          : new Date();
        const endDate = new Date(startDate);
        endDate.setUTCMonth(endDate.getUTCMonth() + durationMonths);

        const primaryAssignment = await getActivePrimaryAssignment(renewalCase.employeeId);
        if (!primaryAssignment) return { error: "Penempatan Utama aktif karyawan ini tidak ditemukan." };

        const drafted = await createRenewalDraftContract({
          oldContractId: renewalCase.currentContractId,
          employeeId: renewalCase.employeeId,
          contractType: renewalCase.currentContract.contractType,
          startDate,
          endDate,
          primaryAssignmentId: primaryAssignment.id,
          actorAccountId: session.user.id,
          buildAuditReason: (contractNumber) =>
            `Drafted renewal ${contractNumber} for ${renewalCase.currentContract.contractNumber} via Contract Renewal Case ${renewalCase.caseNumber}`,
        });
        generatedContractId = drafted.id;
      }
      // Mutasi/Demosi: contract generation stays disabled until HR Admin
      // executes the (now-approved) linked Perubahan Posisi — see the
      // Contract detail page's gating, which reads linkedMovementRequest.
      // status live rather than storing a duplicate flag here (WF-12).
    }

    const updatedCase = await tx.contractRenewalCase.update({
      where: { id: caseId },
      data: {
        status: decision,
        decisionAt: new Date(),
        decisionByAccountId: session.user.id,
        decisionPositionId,
        finalRecommendation,
        changeReason,
        decisionNote,
        linkedMovementRequestId,
        generatedContractId,
      },
    });

    return { updatedCase };
  });

  if ("error" in result) return result.error;

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    datasetName: "ContractRenewalCase",
    recordId: caseId,
    reason: decisionNote ?? `Renewal case ${renewalCase.caseNumber} ${decision.toLowerCase()}`,
  });

  revalidatePath(`/contracts/${renewalCase.currentContractId}`);
  revalidatePath("/contracts");
  revalidatePath("/movements");
}

// After HR Admin executes the now-approved linked Perubahan Posisi (via the
// existing /movements executeMovementRequest action, unchanged), the
// Mutasi/Demosi path's contract draft can finally be created — using
// whatever Position the employee now holds (already updated by execution),
// same as WF-12's "uses the approved new Position."
export async function createRenewalContractAfterMovementExecuted(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return t("common.forbidden");

  const renewalCase = await prisma.contractRenewalCase.findUnique({
    where: { id: caseId },
    include: { currentContract: true, linkedMovementRequest: true },
  });
  if (!renewalCase) return "Kasus tidak ditemukan.";
  if (renewalCase.status !== "APPROVED" || !renewalCase.finalRecommendation || !requiresLinkedMovement(renewalCase.finalRecommendation)) {
    return "Kasus ini tidak menunggu pembuatan kontrak setelah Perubahan Posisi.";
  }
  if (!renewalCase.linkedMovementRequest || renewalCase.linkedMovementRequest.status !== "IMPLEMENTED") {
    return "Perubahan Posisi terkait belum dilaksanakan oleh Admin SDM.";
  }
  if (renewalCase.generatedContractId) return "Draf kontrak untuk kasus ini sudah dibuat.";
  // Per direct user request: "Contract generation must use the Position
  // attached to that Assignment" — the specific new Assignment the Movement
  // itself created (implementedAssignmentId), not a fresh "current Primary"
  // lookup, since both should coincide here but this is the more precise,
  // directly-traceable reference to the exact assignment this contract is for.
  if (!renewalCase.linkedMovementRequest.implementedAssignmentId) {
    return "Penempatan hasil pelaksanaan Perubahan Posisi tidak ditemukan.";
  }

  const contractType = renewalCase.currentContract.contractType;
  const startDate = (formData.get("startDate") as string) || null;
  const endDate = (formData.get("endDate") as string) || null;
  if (!startDate) return "Tanggal mulai wajib diisi.";

  const drafted = await createRenewalDraftContract({
    oldContractId: renewalCase.currentContractId,
    employeeId: renewalCase.employeeId,
    contractType,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    primaryAssignmentId: renewalCase.linkedMovementRequest.implementedAssignmentId,
    actorAccountId: session.user.id,
    buildAuditReason: (contractNumber) =>
      `Drafted renewal ${contractNumber} for ${renewalCase.currentContract.contractNumber} via Contract Renewal Case ${renewalCase.caseNumber} (post Perubahan Posisi execution)`,
  });

  await prisma.contractRenewalCase.update({
    where: { id: caseId },
    data: { generatedContractId: drafted.id },
  });

  revalidatePath(`/contracts/${renewalCase.currentContractId}`);
  revalidatePath(`/contracts/${drafted.id}`);
}

// LIF-12: "An approved non-renewal decision... HR Admin then creates the
// contract-end separation process without re-entering Employee data and
// manages exit clearance. No new contract is generated." The Dept-Head/
// HR-Manager rationale already lives on this case's own combined decision
// (decisionNote/changeReason) — createOffboardingCaseInternal starts the
// case directly at PENDING_CLEARANCE, skipping a second HR Manager
// decision on the same outcome. The unique sourceRenewalCaseId FK is the
// idempotency guard (same pattern as the D-30 trigger's own unique
// constraint) — a second click simply returns the already-created case.
export async function createOffboardingHandoff(caseId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageContracts(session)) return t("common.forbidden");

  const renewalCase = await prisma.contractRenewalCase.findUnique({
    where: { id: caseId },
    include: { currentContract: true, offboardingCase: true },
  });
  if (!renewalCase) return "Kasus tidak ditemukan.";
  if (renewalCase.status !== "APPROVED" || renewalCase.finalRecommendation !== "TIDAK_DIPERPANJANG") {
    return "Kasus ini bukan keputusan Tidak Diperpanjang yang disetujui.";
  }
  if (!renewalCase.currentContract.endDate) return "Kontrak ini tidak memiliki Tanggal Berakhir.";

  // Never two open offboarding cases for one person (a resignation and a
  // non-renewal at the same time). The case already linked to this renewal is
  // the one exception: it is the one being reopened below.
  const otherOpenCase = await prisma.offboardingCase.findFirst({
    where: {
      employeeId: renewalCase.employeeId,
      status: "PENDING_CLEARANCE",
      ...(renewalCase.offboardingCase ? { id: { not: renewalCase.offboardingCase.id } } : {}),
    },
    select: { caseNumber: true },
  });
  if (otherOpenCase) {
    return `Karyawan ini sudah memiliki kasus Offboarding aktif (${otherOpenCase.caseNumber}). Selesaikan atau batalkan kasus itu terlebih dahulu.`;
  }

  if (renewalCase.offboardingCase) {
    const existing = renewalCase.offboardingCase;
    if (existing.status !== "CANCELLED") return "Proses Offboarding untuk kasus ini sudah dibuat.";

    // A cancelled case is reopened (the renewal case links to exactly one
    // offboarding case), so a non-renewal can be restarted after a cancel
    // (decided 2026-10-08).
    await prisma.offboardingCase.update({
      where: { id: existing.id },
      data: {
        status: "PENDING_CLEARANCE",
        lastWorkingDay: renewalCase.currentContract.endDate,
        clearanceDueDate: renewalCase.currentContract.endDate,
        cancelledAt: null,
        cancelledByAccountId: null,
        cancellationReason: null,
      },
    });
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "OffboardingCase",
      recordId: existing.id,
      reason: `${existing.caseNumber} reopened from the non-renewal decision (was cancelled: ${existing.cancellationReason ?? "-"})`,
    });

    revalidatePath(`/contracts/${renewalCase.currentContractId}`);
    revalidatePath(`/offboarding/${existing.id}`);
    revalidatePath("/offboarding");
    return undefined;
  }

  await createOffboardingCaseInternal({
    employeeId: renewalCase.employeeId,
    reason: "CONTRACT_NON_RENEWAL",
    lastWorkingDay: renewalCase.currentContract.endDate,
    reportedByAccountId: session.user.id,
    sourceRenewalCaseId: renewalCase.id,
  });

  revalidatePath(`/contracts/${renewalCase.currentContractId}`);
  revalidatePath("/offboarding");
}

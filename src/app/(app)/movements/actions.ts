"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitMovementRequest,
  canApproveMovementRequest,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  isHrManager,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary, syncPositionStatus } from "@/lib/position-occupancy";
import {
  formatMovementRequestNumber,
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
  requiresProposedEmploymentStatus,
  validateProposedPosition,
} from "@/lib/movement";
import type { MovementType, EmploymentStatus } from "@/generated/prisma/enums";

export async function submitMovementRequest(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const employeeId = formData.get("employeeId") as string;
  const movementType = formData.get("movementType") as MovementType;
  const proposedPositionId = formData.get("proposedPositionId") as string;
  const proposedEmploymentStatus = (formData.get("proposedEmploymentStatus") as string) || null;
  const proposedEffectiveDate = formData.get("proposedEffectiveDate") as string;
  const requestReason = (formData.get("requestReason") as string)?.trim();
  const requesterEmployeeId = (formData.get("requesterEmployeeId") as string) || session.user.employeeId;

  if (
    !employeeId ||
    !movementType ||
    !proposedPositionId ||
    !proposedEffectiveDate ||
    !requestReason ||
    !requesterEmployeeId
  ) {
    return "Karyawan, jenis mutasi, posisi yang diusulkan, tanggal efektif, alasan, dan pengaju wajib diisi.";
  }
  if (requiresProposedEmploymentStatus(movementType) && !proposedEmploymentStatus) {
    return "Status Kepegawaian yang diusulkan wajib diisi untuk jenis Perubahan Status.";
  }

  const isManager = await isDirectManagerOfEmployee(session.user.employeeId, employeeId);
  if (!canSubmitMovementRequest(session, isManager)) return "Anda tidak memiliki akses.";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";
  if (!employee.currentPositionId) return "Karyawan ini belum memiliki Posisi saat ini.";

  const positionError = validateProposedPosition(movementType, employee.currentPositionId, proposedPositionId);
  if (positionError) return positionError;

  if (
    movementType !== "STATUS_CHANGE" &&
    (await isPositionOccupiedByPrimary(proposedPositionId, employeeId))
  ) {
    return "Posisi yang diusulkan sudah memiliki pemegang Utama aktif — pilih posisi lain.";
  }

  const requester = await prisma.employee.findUnique({ where: { id: requesterEmployeeId } });
  if (!requester) return "Karyawan pengaju tidak ditemukan.";

  const year = new Date().getFullYear();
  const countThisYear = await prisma.movementRequest.count({
    where: { requestNumber: { startsWith: `MOV-${year}-` } },
  });
  const requestNumber = formatMovementRequestNumber(countThisYear + 1, year);

  const request = await prisma.movementRequest.create({
    data: {
      requestNumber,
      employeeId,
      movementType,
      currentPositionId: employee.currentPositionId,
      proposedPositionId,
      proposedEmploymentStatus: proposedEmploymentStatus ? (proposedEmploymentStatus as EmploymentStatus) : null,
      proposedEffectiveDate: new Date(proposedEffectiveDate),
      requestReason,
      status: "SUBMITTED",
      requesterEmployeeId: requester.id,
      requesterPositionId: requester.currentPositionId,
      submittedByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "MovementRequest",
    recordId: request.id,
    reason: `Submitted movement request ${requestNumber} for employee ${employeeId} (${movementType})`,
  });

  revalidatePath("/movements");
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/movements/${request.id}`);
}

export async function decideMovementRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canApproveMovementRequest(hrManagerPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya HR Manager aktif yang dapat memutuskan permintaan ini.";
  }

  const decisionPositionId = formData.get("decisionPositionId") as string;
  if (!hrManagerPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi HR Manager yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const request = await prisma.movementRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canDecideMovementRequestStatus(request.status)) return "Permintaan ini sudah diproses.";

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if (decision === "REJECTED" && !decisionNote) return "Catatan keputusan wajib diisi untuk Tolak.";

  if (
    decision === "APPROVED" &&
    request.movementType !== "STATUS_CHANGE" &&
    (await isPositionOccupiedByPrimary(request.proposedPositionId, request.employeeId))
  ) {
    return "Posisi yang diusulkan sudah memiliki pemegang Utama aktif — permintaan ini tidak dapat disetujui.";
  }

  await prisma.movementRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      decisionAt: new Date(),
      decisionByAccountId: session.user.id,
      decisionPositionId,
      decisionNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    datasetName: "MovementRequest",
    recordId: requestId,
    reason: decisionNote ?? `Request ${request.requestNumber} ${decision.toLowerCase()}`,
  });

  revalidatePath(`/movements/${requestId}`);
  revalidatePath("/movements");
}

// LIF-04: "HR Admin executes the future/effective-dated Position Assignment
// and preserves previous records." Same close-old/open-new mechanics as the
// direct Movement action (assignment-actions.ts's movePrimaryAssignment) —
// deliberately not shared code, since that action still owns its own
// simpler direct-correction path; duplicating a few lines here keeps each
// action's pre-conditions (approval status vs. none) independently clear.
export async function executeMovementRequest(requestId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canExecuteMovementRequest(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.movementRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canExecuteMovementRequestStatus(request.status)) {
    return "Permintaan ini belum disetujui atau sudah dilaksanakan.";
  }

  if (
    request.movementType !== "STATUS_CHANGE" &&
    (await isPositionOccupiedByPrimary(request.proposedPositionId, request.employeeId))
  ) {
    return "Posisi yang diusulkan sudah memiliki pemegang Utama aktif — pilih Posisi lain sebelum melaksanakan.";
  }

  const result = await prisma.$transaction(async (tx) => {
    let newAssignmentId: string | null = null;

    if (request.movementType !== "STATUS_CHANGE") {
      const currentPrimary = await tx.assignment.findFirst({
        where: { employeeId: request.employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
      });
      if (currentPrimary) {
        await tx.assignment.update({
          where: { id: currentPrimary.id },
          data: { status: "ENDED", effectiveTo: request.proposedEffectiveDate },
        });
      }
      const newAssignment = await tx.assignment.create({
        data: {
          employeeId: request.employeeId,
          positionId: request.proposedPositionId,
          assignmentType: "PRIMARY",
          primaryAssignmentFlag: true,
          status: "ACTIVE",
          effectiveFrom: request.proposedEffectiveDate,
        },
      });
      newAssignmentId = newAssignment.id;
      await tx.employee.update({
        where: { id: request.employeeId },
        data: { currentPositionId: request.proposedPositionId },
      });
      if (currentPrimary) {
        await syncPositionStatus(currentPrimary.positionId);
      }
      await syncPositionStatus(request.proposedPositionId);
    }

    if (request.proposedEmploymentStatus) {
      await tx.employee.update({
        where: { id: request.employeeId },
        data: { employmentStatus: request.proposedEmploymentStatus },
      });
    }

    await tx.movementRequest.update({
      where: { id: requestId },
      data: {
        status: "IMPLEMENTED",
        implementedAt: new Date(),
        implementedByAccountId: session.user.id,
        implementedAssignmentId: newAssignmentId,
      },
    });

    return { newAssignmentId };
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MovementRequest",
    recordId: requestId,
    reason: `Executed ${request.requestNumber}${result.newAssignmentId ? ` (assignment ${result.newAssignmentId})` : " (employment status only)"}`,
  });

  revalidatePath(`/movements/${requestId}`);
  revalidatePath("/movements");
  revalidatePath(`/employees/${request.employeeId}`);
  revalidatePath("/organization");
}

export async function cancelMovementRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.movementRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";

  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const activeHrManagerPositionIds = hrManagerPositions.map((p) => p.positionId);
  if (!canCancelMovementRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds)) {
    return "Anda tidak memiliki akses untuk membatalkan permintaan ini.";
  }
  if (!canCancelMovementRequestStatus(request.status)) {
    return "Permintaan yang sudah Ditolak, Dilaksanakan, atau Dibatalkan tidak dapat dibatalkan.";
  }

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  const isRequester = session.user.employeeId === request.requesterEmployeeId;
  const cancellationAuthority = isHrManager(activeHrManagerPositionIds)
    ? "HR_MANAGER"
    : isRequester
      ? "REQUESTER"
      : "HR_ADMIN";

  await prisma.movementRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      previousStatus: request.status,
      cancelledAt: new Date(),
      cancelledByAccountId: session.user.id,
      cancelledByEmployeeId: session.user.employeeId,
      cancellationAuthority,
      cancellationReason,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MovementRequest",
    recordId: requestId,
    reason: `Cancelled ${request.requestNumber} (was ${request.status}, authority: ${cancellationAuthority}): ${cancellationReason}`,
  });

  revalidatePath(`/movements/${requestId}`);
  revalidatePath("/movements");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitMovementRequest,
  canApproveMovementRequest,
  canApproveMovementRequestAsDeptHead,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  isSelfApprovalAttempt,
  isHrManager,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions, getDeptHeadApprovers } from "@/lib/dept-head";
import { isLevel3ForEmployeeDepartment, resolveDepartmentId } from "@/lib/level3-scope";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary, syncPositionStatus } from "@/lib/position-occupancy";
import {
  formatMovementRequestNumber,
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
  requiresProposedEmploymentStatus,
  validateProposedPosition,
  isPerubahanPosisiType,
  validateJobLevelDirection,
} from "@/lib/movement";
import { requiresEvaluationForMovementType, movementTypeToEvaluationPurpose, isEvaluationGateSatisfied } from "@/lib/evaluation";
import { createDraftEvaluation } from "@/app/(app)/evaluations/actions";
import type { MovementType, EmploymentStatus } from "@/generated/prisma/enums";

export async function submitMovementRequest(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const employeeId = formData.get("employeeId") as string;
  const movementType = formData.get("movementType") as MovementType;
  const currentAssignmentId = formData.get("currentAssignmentId") as string;
  const proposedPositionId = formData.get("proposedPositionId") as string;
  const proposedEmploymentStatus = (formData.get("proposedEmploymentStatus") as string) || null;
  const proposedEffectiveDate = formData.get("proposedEffectiveDate") as string;
  const requestReason = (formData.get("requestReason") as string)?.trim();
  const requesterEmployeeId = (formData.get("requesterEmployeeId") as string) || session.user.employeeId;
  const performanceEvaluationRef = (formData.get("performanceEvaluationRef") as string)?.trim() || null;

  if (
    !employeeId ||
    !movementType ||
    !currentAssignmentId ||
    !proposedPositionId ||
    !proposedEffectiveDate ||
    !requestReason ||
    !requesterEmployeeId
  ) {
    return "Karyawan, jenis perubahan, Assignment saat ini, posisi yang diusulkan, tanggal efektif, alasan, dan pengaju wajib diisi.";
  }
  // Perubahan Posisi refactor: only Promosi/Mutasi/Demotasi are submittable
  // going forward — enforced server-side, not just by the form's dropdown,
  // since Rotasi/Perubahan Status remain valid historical types that must
  // never be creatable again.
  if (!isPerubahanPosisiType(movementType)) {
    return "Perubahan Posisi hanya mendukung Promosi, Mutasi, dan Demosi.";
  }
  if (requiresProposedEmploymentStatus(movementType) && !proposedEmploymentStatus) {
    return "Status Kepegawaian yang diusulkan wajib diisi untuk jenis Perubahan Status.";
  }
  // DM-27/WF-17/LIF-14: a real shared Evaluation is now auto-created below
  // for every Promosi/Mutasi/Demosi — the requester no longer types or
  // links a free-text reference at submission (superseded; the field stays
  // as an optional HR-only supplementary note for legacy rows only).

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { currentPosition: { include: { job: true } } },
  });
  if (!employee) return "Karyawan tidak ditemukan.";
  if (!employee.currentPositionId || !employee.currentPosition) {
    return "Karyawan ini belum memiliki Posisi saat ini.";
  }

  // The request must identify exactly which Assignment is being changed —
  // must belong to this employee, be currently ACTIVE, and be the
  // Assignment for their current Position (not some other concurrent
  // Additional/Acting/Temporary Assignment, which must remain untouched).
  const currentAssignment = await prisma.assignment.findUnique({ where: { id: currentAssignmentId } });
  if (
    !currentAssignment ||
    currentAssignment.employeeId !== employeeId ||
    currentAssignment.status !== "ACTIVE" ||
    currentAssignment.positionId !== employee.currentPositionId
  ) {
    return "Assignment saat ini yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const eligible = await isLevel3ForEmployeeDepartment(session.user.employeeId, employeeId);
  if (!canSubmitMovementRequest(session, eligible)) {
    return "Anda tidak memiliki akses. Hanya pemegang Posisi Level 3 (3A/3B) di department karyawan ini yang dapat mengajukan.";
  }

  const positionError = validateProposedPosition(movementType, employee.currentPositionId, proposedPositionId);
  if (positionError) return positionError;

  const proposedPosition = await prisma.position.findUnique({
    where: { id: proposedPositionId },
    include: { job: true },
  });
  if (!proposedPosition) return "Posisi yang diusulkan tidak ditemukan.";

  const levelError = validateJobLevelDirection(
    movementType,
    employee.currentPosition.jobLevel,
    proposedPosition.jobLevel
  );
  if (levelError) return levelError;

  if (
    movementType !== "STATUS_CHANGE" &&
    (await isPositionOccupiedByPrimary(proposedPositionId, employeeId))
  ) {
    return "Posisi yang diusulkan sudah memiliki pemegang Utama aktif — pilih posisi lain.";
  }

  const requester = await prisma.employee.findUnique({ where: { id: requesterEmployeeId } });
  if (!requester) return "Karyawan pengaju tidak ditemukan.";

  // Perubahan Posisi refactor: Department Head 3B approval is never
  // silently bypassed for the specific case the spec calls out — the
  // requester being the *only* level-3B holder in this department, which
  // would force them to approve their own submission. That's a narrower
  // check than "does this department have a level-3B position at all":
  // most departments don't have one yet (only Finance & Procurement and
  // Produksi do, as of this writing), and blocking every submission until
  // one exists everywhere would make the feature unusable company-wide.
  // A request with no current approver simply sits at PENDING_DEPT_HEAD —
  // same accepted, cancellable-in-the-meantime behavior as Recruitment's
  // own dept-head gate — rather than being refused at submit time.
  const departmentId = await resolveDepartmentId(employee.currentPosition.orgUnitId);
  if (!departmentId) {
    return "Department tidak dapat ditentukan dari Posisi karyawan ini — hubungi Admin SDM.";
  }
  const deptHeadApprovers = await getDeptHeadApprovers(departmentId);
  const submitterIsOnlyDeptHead =
    deptHeadApprovers.length > 0 &&
    deptHeadApprovers.every((a) => a.employeeId === session.user.employeeId);
  if (submitterIsOnlyDeptHead) {
    return "Kesalahan konfigurasi routing: Anda adalah satu-satunya Kepala Departemen/Manajer (Level 3B) di department ini. Tetapkan Kepala Departemen/Manajer pengganti (Acting) sebelum mengajukan permintaan ini sendiri.";
  }

  const year = new Date().getFullYear();
  const countThisYear = await prisma.movementRequest.count({
    where: { requestNumber: { startsWith: `MOV-${year}-` } },
  });
  const requestNumber = formatMovementRequestNumber(countThisYear + 1, year);

  // DM-27/WF-17/LIF-14: every Promosi, Mutasi or Demotasi auto-creates one
  // linked Evaluation Draft on submission — never a requester trigger
  // (ACC-16/17). Created before the request itself so it can be linked in
  // the same insert; nothing is released to evaluators yet, and HR Admin
  // still has to release it before Dept Head/HR Manager can complete.
  let evaluationId: string | null = null;
  if (requiresEvaluationForMovementType(movementType)) {
    const purpose = movementTypeToEvaluationPurpose(movementType)!;
    const evaluation = await createDraftEvaluation({
      employeeId,
      purpose,
      primaryAssignmentId: currentAssignmentId,
      snapshotPositionId: employee.currentPositionId,
      createdByAccountId: session.user.id,
    });
    evaluationId = evaluation.id;
  }

  const request = await prisma.movementRequest.create({
    data: {
      requestNumber,
      employeeId,
      movementType,
      currentPositionId: employee.currentPositionId,
      currentAssignmentId,
      proposedPositionId,
      proposedEmploymentStatus: proposedEmploymentStatus ? (proposedEmploymentStatus as EmploymentStatus) : null,
      proposedEffectiveDate: new Date(proposedEffectiveDate),
      requestReason,
      status: "PENDING_DEPT_HEAD",
      requesterEmployeeId: requester.id,
      requesterPositionId: requester.currentPositionId,
      submittedByAccountId: session.user.id,
      performanceEvaluationRef,
      evaluationId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "MovementRequest",
    recordId: request.id,
    reason: `Submitted Perubahan Posisi request ${requestNumber} for employee ${employeeId} (${movementType})`,
  });

  revalidatePath("/movements");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/evaluations");
  redirect(`/movements/${request.id}`);
}

// Perubahan Posisi refactor: Department Head 3B decision (first stage) —
// same evidence shape as decideMovementRequest below (WF-02/WF-05: record
// the specific qualifying Position). Approve unblocks the HR Manager's
// queue (status -> SUBMITTED); Reject/Return short-circuit the request.
export async function decideMovementRequestAsDeptHead(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.movementRequest.findUnique({
    where: { id: requestId },
    include: { currentPosition: true, evaluation: true },
  });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.status !== "PENDING_DEPT_HEAD") return "Permintaan ini sudah diproses.";

  if (isSelfApprovalAttempt(session.user.employeeId, request.requesterEmployeeId)) {
    return "Anda tidak dapat memutuskan permintaan yang Anda ajukan sendiri.";
  }

  // WF-17/ACC-16: "Block Department Head/HR Manager completion until
  // evaluation is Completed" — a null evaluation only occurs on a legacy
  // pre-refactor row and is never blocked.
  if (!isEvaluationGateSatisfied(request.evaluation?.status ?? null)) {
    return "Evaluasi FR-HC-01-07 (P1 dan P2) harus selesai terlebih dahulu.";
  }

  const departmentId = await resolveDepartmentId(request.currentPosition.orgUnitId);
  if (!departmentId) return "Department tidak dapat ditentukan dari Posisi karyawan ini.";

  const deptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, departmentId);
  if (!canApproveMovementRequestAsDeptHead(deptHeadPositions.map((p) => p.positionId))) {
    return "Anda tidak memiliki akses. Hanya Kepala Departemen/Manajer (Level 3B) di department ini yang dapat memutuskan permintaan ini.";
  }

  const decisionPositionId = formData.get("decisionPositionId") as string;
  if (!deptHeadPositions.some((p) => p.positionId === decisionPositionId)) {
    return "Posisi Kepala Departemen/Manajer yang dipilih tidak valid atau tidak lagi aktif.";
  }

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if ((decision === "REJECTED" || decision === "RETURNED") && !decisionNote) {
    return "Catatan keputusan wajib diisi untuk Tolak/Kembalikan.";
  }

  await prisma.movementRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVED" ? "SUBMITTED" : decision,
      deptHeadDecisionAt: new Date(),
      deptHeadDecisionByAccountId: session.user.id,
      deptHeadDecisionPositionId: decisionPositionId,
      deptHeadDecisionNote: decisionNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    datasetName: "MovementRequest",
    recordId: requestId,
    reason: decisionNote ?? `Request ${request.requestNumber} ${decision.toLowerCase()} by dept head/manager`,
  });

  revalidatePath(`/movements/${requestId}`);
  revalidatePath("/movements");
  revalidatePath("/approvals");
}

// HR Manager decision (final stage) — only reachable once Dept Head 3B has
// approved (request.status === "SUBMITTED", enforced by
// canDecideMovementRequestStatus, unchanged from before this refactor).
export async function decideMovementRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
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

  const request = await prisma.movementRequest.findUnique({ where: { id: requestId }, include: { evaluation: true } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canDecideMovementRequestStatus(request.status)) return "Permintaan ini sudah diproses.";

  if (isSelfApprovalAttempt(session.user.employeeId, request.requesterEmployeeId)) {
    return "Anda tidak dapat memutuskan permintaan yang Anda ajukan sendiri.";
  }

  // WF-17/ACC-16: same Evaluation-Completed gate as the Dept Head stage —
  // checked again here since a request can only reach this stage after the
  // Dept Head already cleared it, but this stays defense-in-depth.
  if (!isEvaluationGateSatisfied(request.evaluation?.status ?? null)) {
    return "Evaluasi FR-HC-01-07 (P1 dan P2) harus selesai terlebih dahulu.";
  }

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if ((decision === "REJECTED" || decision === "RETURNED") && !decisionNote) {
    return "Catatan keputusan wajib diisi untuk Tolak/Kembalikan.";
  }

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

// Perubahan Posisi refactor: HR Admin adds/verifies the HR-only supporting
// fields (FR-HC-01-09's 3-month attendance block + evaluation reference +
// confidential notes) — never visible or editable by the Level-3 requester.
// Not status-gated beyond "not yet a terminal state", since HR Admin may
// need to add these at any point before the HR Manager's final decision.
export async function updateMovementHrFields(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canExecuteMovementRequest(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.movementRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.status === "IMPLEMENTED" || request.status === "CANCELLED") {
    return "Permintaan ini sudah selesai diproses.";
  }

  const parseCount = (name: string): number | null => {
    const raw = (formData.get(name) as string)?.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  await prisma.movementRequest.update({
    where: { id: requestId },
    data: {
      attendanceAlpha: parseCount("attendanceAlpha"),
      attendanceSakit: parseCount("attendanceSakit"),
      attendanceIjin: parseCount("attendanceIjin"),
      attendanceIjinHalfDay: parseCount("attendanceIjinHalfDay"),
      attendanceCuti: parseCount("attendanceCuti"),
      performanceEvaluationRef: (formData.get("performanceEvaluationRef") as string)?.trim() || null,
      hrConfidentialNotes: (formData.get("hrConfidentialNotes") as string)?.trim() || null,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MovementRequest",
    recordId: requestId,
    reason: `Updated HR-only supporting fields on ${request.requestNumber}`,
  });

  revalidatePath(`/movements/${requestId}`);
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

  // Perubahan Posisi refactor: end-date exactly the Assignment the request
  // identified at submission (currentAssignmentId) rather than re-deriving
  // "the Primary" at execution time — pre-refactor rows have no
  // currentAssignmentId, so they fall back to the old re-derivation for
  // backward compatibility.
  const assignmentToEnd = request.currentAssignmentId
    ? await prisma.assignment.findUnique({ where: { id: request.currentAssignmentId } })
    : await prisma.assignment.findFirst({
        where: { employeeId: request.employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
      });
  if (request.currentAssignmentId && (!assignmentToEnd || assignmentToEnd.status !== "ACTIVE")) {
    return "Assignment yang akan diakhiri sudah tidak aktif — permintaan ini perlu ditinjau ulang.";
  }

  const result = await prisma.$transaction(async (tx) => {
    let newAssignmentId: string | null = null;

    if (request.movementType !== "STATUS_CHANGE") {
      if (assignmentToEnd) {
        await tx.assignment.update({
          where: { id: assignmentToEnd.id },
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
      if (assignmentToEnd) {
        await syncPositionStatus(assignmentToEnd.positionId);
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

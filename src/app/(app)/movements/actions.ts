"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { authorizeDeptHeadDecision, authorizeHrManagerDecision } from "@/lib/approval-authority";
import { companyYear, companyToday } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitMovementRequest,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  isHrAdmin,
  isHrManager,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { isLevel3ForEmployeeDepartment, resolveDepartmentId } from "@/lib/level3-scope";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary, syncPositionStatus } from "@/lib/position-occupancy";
import { shouldScheduleMove } from "@/lib/placement-timing";
import {
  formatMovementRequestNumber,
  OPEN_MOVEMENT_STATUSES,
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
  requiresProposedEmploymentStatus,
  validateProposedPosition,
  isPerubahanPosisiType,
  validateJobLevelDirection,
} from "@/lib/movement";
import { movementNeedsEvaluation, movementTypeToEvaluationPurpose, isEvaluationGateSatisfied } from "@/lib/evaluation";
import { createDraftEvaluation } from "@/lib/evaluation-create";
import { completeInternalHire, notifyManagersOfInternalHire } from "@/lib/recruitment-flow";
import { mutationFillProblem } from "@/lib/mutation-fill";
import { canManageRecruitment } from "@/lib/permissions";
import type { MovementType, EmploymentStatus, RecruitmentRequestStatus } from "@/generated/prisma/enums";

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
  let requesterEmployeeId = (formData.get("requesterEmployeeId") as string) || session.user.employeeId;
  const performanceEvaluationRef = (formData.get("performanceEvaluationRef") as string)?.trim() || null;
  // Set when HR Admin opened this form from an internal applicant (Rekrutmen).
  const candidateId = (formData.get("candidateId") as string) || null;
  // Set when Admin SDM filed this Mutasi to fill a recruitment request ("Isi dengan Mutasi").
  const recruitmentRequestId = (formData.get("recruitmentRequestId") as string) || null;
  let fillRequest: { jobId: string | null; status: RecruitmentRequestStatus; requestedHeadcount: number; requesterEmployeeId: string; filled: number; held: boolean } | null = null;
  if (recruitmentRequestId) {
    if (!isHrAdmin(session)) return "Hanya Admin SDM yang bisa mengisi permintaan tenaga kerja dengan Mutasi.";
    const r = await prisma.recruitmentRequest.findUnique({
      where: { id: recruitmentRequestId },
      select: { jobId: true, status: true, requestedHeadcount: true, requesterEmployeeId: true, heldAt: true, _count: { select: { fulfillments: true } } },
    });
    if (!r) return "Permintaan tenaga kerja tidak ditemukan.";
    fillRequest = { jobId: r.jobId, status: r.status, requestedHeadcount: r.requestedHeadcount, requesterEmployeeId: r.requesterEmployeeId, filled: r._count.fulfillments, held: r.heldAt !== null };
    // the move is filed on behalf of the request's own requester
    requesterEmployeeId = r.requesterEmployeeId;
  }
  // Admin Rekrutmen has no employee record, so the vacancy's own requester files the move.
  if (candidateId && canManageRecruitment(session) && !isHrAdmin(session)) {
    const c = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId }, select: { request: { select: { requesterEmployeeId: true } } } });
    if (c) requesterEmployeeId = c.request.requesterEmployeeId;
  }

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
  // Admin Rekrutmen may submit only for an internal applicant (checked against the applicant below).
  if (!canSubmitMovementRequest(session, eligible) && !(candidateId && canManageRecruitment(session))) {
    return "Anda tidak memiliki akses. Hanya pemegang Posisi Level 3 (3A/3B) di department karyawan ini yang dapat mengajukan.";
  }

  // One open request per employee: a second one could be approved alongside
  // the first and would then fail at execution.
  const openRequest = await prisma.movementRequest.findFirst({
    where: { employeeId, status: { in: OPEN_MOVEMENT_STATUSES } },
    select: { requestNumber: true },
  });
  if (openRequest) {
    return `Karyawan ini masih memiliki permintaan Perubahan Posisi yang berjalan (${openRequest.requestNumber}). Selesaikan atau batalkan permintaan itu terlebih dahulu.`;
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

  if (recruitmentRequestId && fillRequest) {
    const mutationsUnderway = await prisma.movementRequest.count({ where: { recruitmentRequestId, status: { in: OPEN_MOVEMENT_STATUSES } } });
    const fillError = mutationFillProblem({
      request: { ...fillRequest, mutationsUnderway },
      movementType,
      position: { jobId: proposedPosition.jobId, positionStatus: proposedPosition.positionStatus, archived: proposedPosition.archived },
    });
    if (fillError) return fillError;
  }

  if (candidateId) {
    const candidate = await prisma.recruitmentCandidate.findUnique({
      where: { id: candidateId },
      select: { source: true, status: true, employeeId: true, requestId: true },
    });
    if (!canManageRecruitment(session) || !candidate || candidate.source !== "INTERNAL" || candidate.status !== "MOVEMENT" || candidate.employeeId !== employeeId) {
      return "Lamaran internal ini tidak bisa dihubungkan ke Perubahan Posisi.";
    }
  }

  // A move already scheduled for the future is still pending on the old
  // placement; a new request now would target a placement that is about to end.
  const alreadyScheduled = await prisma.assignment.findFirst({
    where: { employeeId, assignmentType: "PRIMARY", status: "SCHEDULED" },
    select: { effectiveFrom: true },
  });
  if (alreadyScheduled) {
    return "Karyawan ini sudah memiliki perpindahan penempatan yang terjadwal. Tunggu sampai berlaku atau batalkan jadwalnya terlebih dahulu.";
  }

  const year = companyYear();
  const seq = await nextSequence(`MOV-${year}`);
  const requestNumber = formatMovementRequestNumber(seq, year);

  // DM-27/WF-17/LIF-14: every Promosi, Mutasi or Demotasi auto-creates one
  // linked Evaluation Draft on submission — never a requester trigger
  // (ACC-16/17). Created before the request itself so it can be linked in
  // the same insert; nothing is released to evaluators yet, and HR Admin
  // still has to release it before Dept Head/HR Manager can complete.
  // Where the move comes from is fixed now: an internal applicant's move, or a Mutasi.
  const origin = candidateId ? "REKRUTMEN_INTERNAL" : "MUTASI";
  let evaluationId: string | null = null;
  if (movementNeedsEvaluation(movementType, origin)) {
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
      recruitmentRequestId,
      origin,
    },
  });
  if (recruitmentRequestId) revalidatePath(`/recruitment/${recruitmentRequestId}`);

  // The applicant's page follows this request from now on.
  if (candidateId) {
    await prisma.recruitmentCandidate.update({ where: { id: candidateId }, data: { movementRequestId: request.id } });
    revalidatePath("/recruitment/applicants");
  }

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
  // Admin Rekrutmen cannot open the movement page; they go back to the applicant.
  if (candidateId && !eligible && !isHrAdmin(session)) {
    const back = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId }, select: { requestId: true } });
    if (back) redirect(`/recruitment/${back.requestId}/candidates/${candidateId}`);
  }
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

  // WF-17/ACC-16: "Block Department Head/HR Manager completion until
  // evaluation is Completed" — a null evaluation only occurs on a legacy
  // pre-refactor row and is never blocked.
  if (!isEvaluationGateSatisfied(request.evaluation?.status ?? null)) {
    return "Evaluasi FR-HC-01-07 harus selesai terlebih dahulu.";
  }

  const departmentId = await resolveDepartmentId(request.currentPosition.orgUnitId);
  if (!departmentId) return "Department tidak dapat ditentukan dari Posisi karyawan ini.";

  const authority = await authorizeDeptHeadDecision({ employeeId: session.user.employeeId, departmentId, formData });
  if (!authority.ok) return authority.error;
  const { decisionPositionId } = authority;

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
  const authority = await authorizeHrManagerDecision({ employeeId: session.user.employeeId, formData });
  if (!authority.ok) return authority.error;
  const { decisionPositionId } = authority;

  const request = await prisma.movementRequest.findUnique({ where: { id: requestId }, include: { evaluation: true } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canDecideMovementRequestStatus(request.status)) return "Permintaan ini sudah diproses.";

  // WF-17/ACC-16: same Evaluation-Completed gate as the Dept Head stage —
  // checked again here since a request can only reach this stage after the
  // Dept Head already cleared it, but this stays defense-in-depth.
  if (!isEvaluationGateSatisfied(request.evaluation?.status ?? null)) {
    return "Evaluasi FR-HC-01-07 harus selesai terlebih dahulu.";
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

  // Recheck at approval: if the placement this request was meant to change is
  // no longer active (the employee was moved or left in the meantime),
  // approving it would only produce a request that can never be executed.
  if (decision === "APPROVED" && request.currentAssignmentId) {
    const assignmentToEnd = await prisma.assignment.findUnique({
      where: { id: request.currentAssignmentId },
      select: { status: true },
    });
    if (!assignmentToEnd || assignmentToEnd.status !== "ACTIVE") {
      return "Penempatan yang akan diubah sudah tidak aktif (karyawan sudah dipindahkan atau keluar). Batalkan permintaan ini dan ajukan ulang.";
    }
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
  if (!canExecuteMovementRequest(session)) return t("common.forbidden");

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

  const request = await prisma.movementRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  // Admin SDM may carry out any approved move; Admin Rekrutmen only one opened from an
  // internal applicant (the applicant's own Perubahan Posisi).
  if (!canExecuteMovementRequest(session)) {
    const linked = canManageRecruitment(session)
      ? await prisma.recruitmentCandidate.findUnique({ where: { movementRequestId: requestId }, select: { id: true } })
      : null;
    if (!linked) return t("common.forbidden");
  }
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

  // A future-dated move keeps the current placement in force until that date
  // (decided 2026-10-08): it only gets an end date, the new placement is stored
  // as SCHEDULED, and the nightly job completes the switch.
  const scheduleMove =
    request.movementType !== "STATUS_CHANGE" &&
    shouldScheduleMove({
      hasCurrentPrimary: !!assignmentToEnd,
      effectiveDate: request.proposedEffectiveDate,
      today: companyToday(),
    });

  const result = await prisma.$transaction(async (tx) => {
    let newAssignmentId: string | null = null;

    if (request.movementType !== "STATUS_CHANGE") {
      if (assignmentToEnd) {
        await tx.assignment.update({
          where: { id: assignmentToEnd.id },
          data: scheduleMove
            ? { effectiveTo: request.proposedEffectiveDate }
            : { status: "ENDED", effectiveTo: request.proposedEffectiveDate },
        });
      }
      const newAssignment = await tx.assignment.create({
        data: {
          employeeId: request.employeeId,
          positionId: request.proposedPositionId,
          assignmentType: "PRIMARY",
          primaryAssignmentFlag: true,
          status: scheduleMove ? "SCHEDULED" : "ACTIVE",
          effectiveFrom: request.proposedEffectiveDate,
        },
      });
      newAssignmentId = newAssignment.id;
      if (!scheduleMove) {
        await tx.employee.update({
          where: { id: request.employeeId },
          data: { currentPositionId: request.proposedPositionId },
        });
        if (assignmentToEnd) {
          await syncPositionStatus(assignmentToEnd.positionId);
        }
        await syncPositionStatus(request.proposedPositionId);
      }
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

    // An internal applicant's move is done: they are finished, and the seat counts for the request.
    const hired = await completeInternalHire(tx, {
      movementRequestId: requestId,
      employeeId: request.employeeId,
      assignmentId: newAssignmentId,
      accountId: session.user.id,
    });

    return { newAssignmentId, hired };
  });

  if (result.hired) {
    await notifyManagersOfInternalHire({
      source: result.hired.source,
      employeeId: request.employeeId,
      oldPositionId: request.currentPositionId,
      newPositionId: request.proposedPositionId,
      effectiveDate: request.proposedEffectiveDate,
    });
    revalidatePath(`/recruitment/${result.hired.requestId}`);
    if (result.hired.candidateId) revalidatePath(`/recruitment/${result.hired.requestId}/candidates/${result.hired.candidateId}`);
    revalidatePath("/recruitment/applicants");
  }

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

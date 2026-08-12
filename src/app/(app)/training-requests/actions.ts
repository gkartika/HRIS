"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitTrainingRequest,
  canDecideTrainingRequestAsDeptHead,
  canValidateTrainingRequest,
  canScheduleTrainingRequest,
  canCancelTrainingRequest as canCancelTrainingRequestByActor,
} from "@/lib/permissions";
import {
  formatTrainingRequestNumber,
  canDeptHeadDecideTrainingRequest,
  canTrainingAdminValidateTrainingRequest,
  canTrainingAdminScheduleTrainingRequest,
  canCancelTrainingRequest as canCancelTrainingRequestStatus,
} from "@/lib/training";
import { resolveDepartmentId, isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { logAudit } from "@/lib/audit";
import type { TrainingRequesterType } from "@/generated/prisma/enums";

// TRN-09/ACC-22: "An Employee may submit a request for self, and a Level 3
// Position may submit for employees in its Department."
export async function submitTrainingRequest(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();

  const targetEmployeeId = ((formData.get("employeeId") as string) || session.user.employeeId || "").trim();
  if (!targetEmployeeId) return "Karyawan wajib dipilih.";

  const isSelf = targetEmployeeId === session.user.employeeId;
  const isLevel3InDept = isSelf ? false : await isLevel3ForEmployeeDepartment(session.user.employeeId, targetEmployeeId);
  if (!canSubmitTrainingRequest(session, isSelf, isLevel3InDept)) return "Anda tidak memiliki akses untuk mengajukan permintaan ini.";

  const requestedTopic = (formData.get("requestedTopic") as string)?.trim();
  const reason = (formData.get("reason") as string)?.trim();
  if (!requestedTopic) return "Topik/kebutuhan pelatihan wajib diisi.";
  if (!reason) return "Alasan wajib dipilih.";

  const gapReferenceNote = (formData.get("gapReferenceNote") as string)?.trim() || null;
  const businessJustification = (formData.get("businessJustification") as string)?.trim() || null;
  const preferredTiming = (formData.get("preferredTiming") as string)?.trim() || null;

  const employee = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    include: { currentPosition: true },
  });
  if (!employee) return "Karyawan tidak ditemukan.";

  const departmentIdSnapshot = employee.currentPosition ? await resolveDepartmentId(employee.currentPosition.orgUnitId) : null;

  const year = new Date().getFullYear();
  const countThisYear = await prisma.trainingRequest.count({ where: { requestNumber: { startsWith: `TRN-${year}-` } } });
  const requestNumber = formatTrainingRequestNumber(countThisYear + 1, year);

  const requesterType: TrainingRequesterType = isSelf ? "SELF" : "LEVEL_3";

  const request = await prisma.trainingRequest.create({
    data: {
      requestNumber,
      requesterType,
      employeeId: employee.id,
      submittedByAccountId: session.user.id,
      departmentIdSnapshot,
      positionIdSnapshot: employee.currentPositionId,
      reason,
      gapReferenceNote,
      requestedTopic,
      businessJustification,
      preferredTiming,
      status: "SUBMITTED",
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "TrainingRequest",
    recordId: request.id,
    reason: `Submitted training request ${requestNumber} for ${employee.fullLegalName}`,
  });

  revalidatePath("/training-requests");
  redirect(`/training-requests/${request.id}`);
}

// TRN-10/ACC-22: "The Department Head approves first... Returned/rejected/
// cancelled reasons are mandatory and audited."
export async function decideTrainingRequestAsDeptHead(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.trainingRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!request.departmentIdSnapshot) return "Departemen karyawan tidak diketahui — tidak dapat diputuskan.";

  const deptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, request.departmentIdSnapshot);
  if (!canDecideTrainingRequestAsDeptHead(deptHeadPositions.map((p) => p.positionId))) return "Anda tidak memiliki akses.";
  if (!canDeptHeadDecideTrainingRequest(request.status)) return "Permintaan ini sudah tidak menunggu keputusan Kepala Departemen.";

  const decision = formData.get("decision") as string;
  const note = (formData.get("note") as string)?.trim();

  if (decision === "approve") {
    await prisma.trainingRequest.update({
      where: { id: requestId },
      data: {
        status: "DEPT_HEAD_APPROVED",
        deptHeadDecisionAt: new Date(),
        deptHeadDecisionByAccountId: session.user.id,
        deptHeadDecisionPositionId: deptHeadPositions[0].positionId,
        deptHeadNote: note || null,
      },
    });
  } else if (decision === "reject") {
    if (!note) return "Alasan penolakan wajib diisi.";
    await prisma.trainingRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        deptHeadDecisionAt: new Date(),
        deptHeadDecisionByAccountId: session.user.id,
        deptHeadDecisionPositionId: deptHeadPositions[0].positionId,
        deptHeadNote: note,
      },
    });
  } else {
    return "Keputusan tidak valid.";
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TrainingRequest",
    recordId: requestId,
    reason: `Dept Head ${decision === "approve" ? "approved" : "rejected"} training request${note ? `: ${note}` : ""}`,
  });

  revalidatePath(`/training-requests/${requestId}`);
  revalidatePath("/approvals");
  redirect(`/training-requests/${requestId}`);
}

// TRN-10: "Training Admin then validates the request, selects or creates
// the course/session."
export async function validateTrainingRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canValidateTrainingRequest(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.trainingRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canTrainingAdminValidateTrainingRequest(request.status)) return "Permintaan ini sudah tidak menunggu validasi.";

  const courseId = (formData.get("courseId") as string)?.trim();
  if (!courseId) return "Pelatihan wajib dipilih.";
  const note = (formData.get("note") as string)?.trim() || null;

  await prisma.trainingRequest.update({
    where: { id: requestId },
    data: {
      status: "VALIDATED",
      courseId,
      trainingAdminDecisionAt: new Date(),
      trainingAdminDecisionByAccountId: session.user.id,
      trainingAdminNote: note,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TrainingRequest",
    recordId: requestId,
    reason: `Training Admin validated training request, course ${courseId}`,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

// TRN-10: "...schedules it and assigns the Employee" — creates the
// LearningAssignment (COM-11: only ever from an approved request or an
// active Mandatory Training rule, never from a bare gap).
export async function scheduleTrainingRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canScheduleTrainingRequest(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.trainingRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canTrainingAdminScheduleTrainingRequest(request.status)) return "Permintaan ini sudah tidak menunggu penjadwalan.";
  if (!request.courseId) return "Pelatihan belum divalidasi.";

  const sessionId = (formData.get("sessionId") as string)?.trim();
  if (!sessionId) return "Sesi wajib dipilih.";

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!trainingSession || trainingSession.courseId !== request.courseId) return "Sesi tidak valid untuk pelatihan ini.";

  const course = await prisma.trainingCourse.findUniqueOrThrow({ where: { id: request.courseId } });

  await prisma.$transaction(async (tx) => {
    await tx.trainingRequest.update({ where: { id: requestId }, data: { status: "SCHEDULED", sessionId } });
    await tx.learningAssignment.create({
      data: {
        employeeId: request.employeeId,
        courseId: request.courseId!,
        sessionId,
        sourceType: "TRAINING_REQUEST",
        sourceTrainingRequestId: requestId,
        assignedByAccountId: session.user.id,
        status: "ASSIGNED",
        effectivenessRequiredSnapshot: course.effectivenessRequired,
      },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TrainingRequest",
    recordId: requestId,
    reason: `Training Admin scheduled session ${sessionId} and assigned employee`,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function cancelTrainingRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.trainingRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";

  const isRequester = session.user.id === request.submittedByAccountId;
  if (!canCancelTrainingRequestByActor(session, isRequester)) return "Anda tidak memiliki akses.";
  if (!canCancelTrainingRequestStatus(request.status)) return "Permintaan ini sudah tidak dapat dibatalkan.";

  const reason = (formData.get("reason") as string)?.trim();
  if (!reason) return "Alasan pembatalan wajib diisi.";

  await prisma.trainingRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByAccountId: session.user.id, cancellationReason: reason },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "TrainingRequest",
    recordId: requestId,
    reason: `Cancelled training request: ${reason}`,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

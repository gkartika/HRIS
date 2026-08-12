"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageLearningAssignment, canRecordLearningEffectiveness } from "@/lib/permissions";
import {
  canConfirmLearningAssignmentAttendance,
  canCompleteLearningAssignment,
  canCancelLearningAssignment,
  computeEffectivenessDueDate,
} from "@/lib/training";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { logAudit } from "@/lib/audit";
import type { EffectivenessResult } from "@/generated/prisma/enums";

export async function confirmLearningAssignmentAttendance(assignmentId: string, _prevState: string | undefined): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageLearningAssignment(session)) return "Anda tidak memiliki akses.";

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return "Penugasan tidak ditemukan.";
  if (!canConfirmLearningAssignmentAttendance(assignment.status)) return "Status penugasan ini tidak dapat diubah menjadi Hadir.";

  await prisma.learningAssignment.update({ where: { id: assignmentId }, data: { status: "ATTENDED", attendanceConfirmedAt: new Date() } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "LearningAssignment",
    recordId: assignmentId,
    reason: "Confirmed attendance",
  });

  revalidatePath("/training/learning-assignments");
  redirect("/training/learning-assignments");
}

// TRN-04/TRN-06: completion is not effectiveness — this only closes
// attendance/certificate; a course with effectiveness_required=Yes hands off
// to the D+30 supervisor task (TRN-15), it never auto-marks effective.
export async function completeLearningAssignment(
  assignmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageLearningAssignment(session)) return "Anda tidak memiliki akses.";

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId }, include: { course: true } });
  if (!assignment) return "Penugasan tidak ditemukan.";
  if (!canCompleteLearningAssignment(assignment.status)) return "Status penugasan ini tidak dapat diubah menjadi Selesai.";

  const certificateNumber = (formData.get("certificateNumber") as string)?.trim() || null;
  const certificateIssueDateRaw = formData.get("certificateIssueDate") as string | null;

  const now = new Date();
  await prisma.learningAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "COMPLETED",
      completedAt: now,
      certificateNumber,
      certificateIssueDate: certificateIssueDateRaw ? new Date(certificateIssueDateRaw) : null,
      effectivenessDueDate: assignment.effectivenessRequiredSnapshot
        ? computeEffectivenessDueDate(now, assignment.course.effectivenessFollowupDays)
        : null,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "LearningAssignment",
    recordId: assignmentId,
    reason: "Marked completed",
  });

  revalidatePath("/training/learning-assignments");
  redirect("/training/learning-assignments");
}

export async function cancelLearningAssignment(assignmentId: string, _prevState: string | undefined): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageLearningAssignment(session)) return "Anda tidak memiliki akses.";

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return "Penugasan tidak ditemukan.";
  if (!canCancelLearningAssignment(assignment.status)) return "Penugasan ini sudah tidak dapat dibatalkan.";

  await prisma.learningAssignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "LearningAssignment",
    recordId: assignmentId,
    reason: "Cancelled learning assignment",
  });

  revalidatePath("/training/learning-assignments");
  redirect("/training/learning-assignments");
}

// TRN-04/TRN-07: "Record evaluator, method, result, evidence and required
// follow-up... the Primary Position supervisor completes it." Never
// overwrites the current competency assessment (TRN-15/COM-12) — this is a
// wholly separate result field.
export async function recordLearningEffectiveness(
  assignmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return "Penugasan tidak ditemukan.";

  const isSupervisor = await isDirectManagerOfEmployee(session.user.employeeId, assignment.employeeId);
  if (!canRecordLearningEffectiveness(session, isSupervisor)) return "Anda tidak memiliki akses.";
  if (assignment.status !== "COMPLETED" || !assignment.effectivenessRequiredSnapshot) return "Evaluasi efektivitas tidak berlaku untuk penugasan ini.";
  if (assignment.effectivenessCompletedAt) return "Evaluasi efektivitas sudah dicatat.";

  const result = formData.get("result") as EffectivenessResult;
  if (result !== "EFFECTIVE" && result !== "NOT_EFFECTIVE") return "Hasil evaluasi wajib dipilih.";
  const evidence = (formData.get("evidence") as string)?.trim() || null;

  await prisma.learningAssignment.update({
    where: { id: assignmentId },
    data: {
      effectivenessResult: result,
      effectivenessEvidence: evidence,
      effectivenessCompletedAt: new Date(),
      effectivenessEvaluatorId: session.user.employeeId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "LearningAssignment",
    recordId: assignmentId,
    reason: `Recorded effectiveness: ${result}`,
  });

  revalidatePath("/training/effectiveness-tasks");
  redirect("/training/effectiveness-tasks");
}

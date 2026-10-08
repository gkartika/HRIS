"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
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
import { canCompleteOnlineLearningAssignment, areRequiredMaterialsComplete, isLearningAssignmentComplete } from "@/lib/lms";
import { isDirectManagerOfEmployee } from "@/lib/manager-scope";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import type { EffectivenessResult } from "@/generated/prisma/enums";

// PDF workflow section C, In-person/Blended branch: "Training Admin records
// attendance and evidence." Evidence upload is optional (a sign-in sheet
// photo, etc.) — attendance itself is what unblocks completion.
export async function confirmLearningAssignmentAttendance(
  assignmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageLearningAssignment(session)) return t("common.forbidden");

  const assignment = await prisma.learningAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return "Penugasan tidak ditemukan.";
  if (!canConfirmLearningAssignmentAttendance(assignment.status)) return "Status penugasan ini tidak dapat diubah menjadi Hadir.";

  const attendanceEvidenceNote = (formData.get("attendanceEvidenceNote") as string)?.trim() || null;
  let attendanceEvidenceFileId: string | null = null;
  const evidenceFile = formData.get("attendanceEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("attendance-evidence", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        employeeId: assignment.employeeId,
        uploadedByAccountId: session.user.id,
        category: "ATTENDANCE_EVIDENCE",
        confidential: true,
      },
    });
    attendanceEvidenceFileId = fileObject.id;
  }

  await prisma.learningAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "ATTENDED",
      attendanceConfirmedAt: new Date(),
      attendanceEvidenceNote,
      ...(attendanceEvidenceFileId ? { attendanceEvidenceFileId } : {}),
    },
  });

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
// PDF workflow section C: mode determines what "all requirements complete"
// means — Online skips the attendance step entirely (ASSIGNED -> COMPLETED
// directly); In-person needs only attendance; Blended needs both.
export async function completeLearningAssignment(
  assignmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageLearningAssignment(session)) return t("common.forbidden");

  const assignment = await prisma.learningAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: { include: { materials: true, quiz: true } },
      materialProgress: true,
      quizAttempts: true,
    },
  });
  if (!assignment) return "Penugasan tidak ditemukan.";

  const requiredMaterialsComplete = areRequiredMaterialsComplete(
    assignment.course.materials.map((m) => ({ id: m.id, isRequired: m.isRequired })),
    new Set(assignment.materialProgress.map((p) => p.materialId))
  );
  const quizRequired = !!assignment.course.quiz;
  const quizPassed = assignment.quizAttempts.some((a) => a.passed);

  if (assignment.course.mode === "ONLINE") {
    if (!canCompleteOnlineLearningAssignment(assignment.status)) return "Status penugasan ini tidak dapat diubah menjadi Selesai.";
    if (!isLearningAssignmentComplete({ mode: "ONLINE", requiredMaterialsComplete, quizRequired, quizPassed, attendanceConfirmed: false })) {
      return "Karyawan belum menyelesaikan seluruh materi wajib dan/atau kuis pelatihan ini.";
    }
  } else {
    if (!canCompleteLearningAssignment(assignment.status)) return "Status penugasan ini tidak dapat diubah menjadi Selesai.";
    if (
      assignment.course.mode === "BLENDED" &&
      !isLearningAssignmentComplete({ mode: "BLENDED", requiredMaterialsComplete, quizRequired, quizPassed, attendanceConfirmed: true })
    ) {
      return "Karyawan belum menyelesaikan seluruh materi wajib dan/atau kuis pelatihan ini.";
    }
  }

  const certificateNumber = (formData.get("certificateNumber") as string)?.trim() || null;
  const certificateIssueDateRaw = formData.get("certificateIssueDate") as string | null;
  const certificateExpiryDateRaw = formData.get("certificateExpiryDate") as string | null;

  let certificateFileId: string | null = null;
  const certificateFile = formData.get("certificateFile") as File | null;
  if (certificateFile && certificateFile.size > 0) {
    const validationError = validateDocumentFile({ name: certificateFile.name, type: certificateFile.type, size: certificateFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("certificate", getExtension(certificateFile.name));
    const bytes = Buffer.from(await certificateFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: certificateFile.name,
        mimeType: certificateFile.type,
        sizeBytes: certificateFile.size,
        sensitivity: "RESTRICTED",
        employeeId: assignment.employeeId,
        uploadedByAccountId: session.user.id,
        category: "CERTIFICATE",
        confidential: true,
      },
    });
    certificateFileId = fileObject.id;
  }

  const now = new Date();
  await prisma.learningAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "COMPLETED",
      completedAt: now,
      certificateNumber,
      certificateIssueDate: certificateIssueDateRaw ? new Date(certificateIssueDateRaw) : null,
      certificateExpiryDate: certificateExpiryDateRaw ? new Date(certificateExpiryDateRaw) : null,
      ...(certificateFileId ? { certificateFileId } : {}),
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
  if (!canManageLearningAssignment(session)) return t("common.forbidden");

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
  if (!canRecordLearningEffectiveness(session, isSupervisor)) return t("common.forbidden");
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

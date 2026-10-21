"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { createDraftEvaluation } from "@/lib/evaluation-create";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canCreateManualEvaluation, canReleaseEvaluation, canSubmitEvaluationAs } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  allAssignedEvaluatorsSubmitted,
  canReleaseEvaluationStatus,
  canSubmitEvaluationSlot,
  parseEvaluationMatrix,
} from "@/lib/evaluation";
import { addWorkingDays } from "@/lib/work-calendar";
import type { Prisma } from "@/generated/prisma/client";


// WF-19/LIF-14 note: HR Admin may also create a Manual HR evaluation for
// other authorized needs, reachable from the Evaluation list.
export async function createManualEvaluation(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateManualEvaluation(session)) return t("common.forbidden");

  const employeeId = (formData.get("employeeId") as string) || "";
  if (!employeeId) return "Karyawan wajib dipilih.";

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const primaryAssignment = await prisma.assignment.findFirst({
    where: { employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
  });

  const created = await createDraftEvaluation({
    employeeId,
    purpose: "MANUAL_HR",
    primaryAssignmentId: primaryAssignment?.id ?? null,
    snapshotPositionId: employee.currentPositionId ?? null,
    createdByAccountId: session.user.id,
  });

  revalidatePath("/evaluations");
  redirect(`/evaluations/${created.id}`);
}

// ACC-17: HR Admin alone reviews a Draft, assigns the evaluator (P1) and, optionally, a second
// different evaluator (P2), and releases it — this is the single action every source
// workflow's "send/release evaluation" button calls.
export async function releaseEvaluation(
  evaluationId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canReleaseEvaluation(session)) return t("common.forbidden");

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { contractRenewalCase: true },
  });
  if (!evaluation) return "Evaluasi tidak ditemukan.";
  if (!canReleaseEvaluationStatus(evaluation.status)) return "Evaluasi ini sudah diproses.";

  const p1EmployeeId = (formData.get("p1EmployeeId") as string) || "";
  const p2EmployeeId = (formData.get("p2EmployeeId") as string) || "";
  if (!p1EmployeeId) return "Evaluator P1 wajib dipilih.";
  if (p2EmployeeId && p1EmployeeId === p2EmployeeId) return "P1 dan P2 harus dua orang yang berbeda.";

  const [p1, p2] = await Promise.all([
    prisma.employee.findUnique({ where: { id: p1EmployeeId } }),
    p2EmployeeId ? prisma.employee.findUnique({ where: { id: p2EmployeeId } }) : Promise.resolve(null),
  ]);
  if (!p1) return "Evaluator P1 tidak ditemukan.";
  if (p2EmployeeId && !p2) return "Evaluator P2 tidak ditemukan.";

  const parseCount = (name: string): number | null => {
    const raw = (formData.get(name) as string)?.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const now = new Date();
  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      status: "RELEASED",
      responsibleHrAdminAccountId: session.user.id,
      releasedByAccountId: session.user.id,
      releasedAt: now,
      evaluationDueDate: addWorkingDays(now, 5),
      attendanceSakit: parseCount("attendanceSakit"),
      attendanceIjin: parseCount("attendanceIjin"),
      attendanceAlpha: parseCount("attendanceAlpha"),
      attendanceIjinHalfDay: parseCount("attendanceIjinHalfDay"),
      p1EmployeeId,
      p1PositionId: p1.currentPositionId,
      p2EmployeeId: p2EmployeeId || null,
      p2PositionId: p2?.currentPositionId ?? null,
    },
  });

  // WF-10: "Upcoming Expiry (D-30) > HR Admin Review > Evaluation Sent" —
  // the Contract Renewal Case's own status is a separate field from the
  // shared Evaluation's, so releasing the Evaluation doesn't automatically
  // move it; do so explicitly here, the one place every source's "release"
  // click passes through. Only TRIGGERED ever needs to move (a case starts
  // there and only this transition ever occurs).
  if (evaluation.contractRenewalCase?.status === "TRIGGERED") {
    await prisma.contractRenewalCase.update({
      where: { id: evaluation.contractRenewalCase.id },
      data: { status: "EVALUATION_SENT" },
    });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Evaluation",
    recordId: evaluationId,
    reason: `Released ${evaluation.evaluationNumber} to P1=${p1EmployeeId}, P2=${p2EmployeeId || "none"}`,
  });

  revalidatePath(`/evaluations/${evaluationId}`);
  revalidatePath("/evaluations");
  revalidatePath("/contracts");
  revalidatePath("/movements");
}

// ACC-17: each evaluator submits only their own assigned slot. When every assigned slot is in (one or
// two), the Evaluation moves straight to Completed — no separate
// HR Admin confirmation step.
export async function submitEvaluation(
  evaluationId: string,
  slot: "P1" | "P2",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) return "Evaluasi tidak ditemukan.";

  const assignedEmployeeId = slot === "P1" ? evaluation.p1EmployeeId : evaluation.p2EmployeeId;
  if (!canSubmitEvaluationAs(session.user.employeeId, assignedEmployeeId)) {
    return "Anda tidak memiliki akses. Hanya evaluator yang ditugaskan yang dapat mengisi evaluasi ini.";
  }
  const alreadySubmittedAt = slot === "P1" ? evaluation.p1SubmittedAt : evaluation.p2SubmittedAt;
  if (!canSubmitEvaluationSlot(evaluation.status, alreadySubmittedAt)) {
    return "Evaluasi ini sudah dikirim atau belum siap menerima evaluasi.";
  }

  const parsed = parseEvaluationMatrix((field) => formData.get(field) as string | null);
  if (!parsed.ok) return parsed.error;
  const scores = parsed.scores as unknown as Prisma.InputJsonValue;
  const total = parsed.performanceTotal;
  const evaluator = await prisma.employee.findUnique({ where: { id: session.user.employeeId! } });

  const now = new Date();
  const bothNowDone = allAssignedEvaluatorsSubmitted({
    p1EmployeeId: evaluation.p1EmployeeId,
    p1SubmittedAt: slot === "P1" ? now : evaluation.p1SubmittedAt,
    p2EmployeeId: evaluation.p2EmployeeId,
    p2SubmittedAt: slot === "P2" ? now : evaluation.p2SubmittedAt,
  });

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      ...(slot === "P1"
        ? { p1SubmittedAt: now, p1Scores: scores, p1Total: total, p1PositionId: evaluator?.currentPositionId }
        : { p2SubmittedAt: now, p2Scores: scores, p2Total: total, p2PositionId: evaluator?.currentPositionId }),
      ...(bothNowDone ? { status: "COMPLETED", completedAt: now } : {}),
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Evaluation",
    recordId: evaluationId,
    reason: `${slot} evaluation submitted for ${evaluation.evaluationNumber} (total ${total})${bothNowDone ? " — Completed" : ""}`,
  });

  revalidatePath(`/evaluations/${evaluationId}`);
  revalidatePath("/contracts");
  revalidatePath("/movements");
}

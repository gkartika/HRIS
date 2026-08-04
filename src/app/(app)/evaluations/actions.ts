"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canCreateManualEvaluation, canReleaseEvaluation, canSubmitEvaluationAs } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  formatEvaluationNumber,
  canReleaseEvaluationStatus,
  canSubmitEvaluationSlot,
  isValidScoreValue,
  computeEvaluationTotal,
  type EvaluationScores,
} from "@/lib/evaluation";
import { addWorkingDays } from "@/lib/work-calendar";
import type { EvaluationPurpose } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// PER-07/WF-19/DEC-020: the ONE shared creator for every source workflow —
// Contract Renewal's D-30 trigger and Perubahan Posisi's submit action both
// call this directly (server-to-server, no client-reachable "request
// evaluation" button anywhere — ACC-16/17: "no requester-trigger control").
export async function createDraftEvaluation(params: {
  employeeId: string;
  purpose: EvaluationPurpose;
  primaryAssignmentId?: string | null;
  snapshotPositionId?: string | null;
  createdByAccountId?: string | null;
}): Promise<{ id: string; evaluationNumber: string }> {
  const year = new Date().getFullYear();
  const countThisYear = await prisma.evaluation.count({
    where: { evaluationNumber: { startsWith: `EVL-${year}-` } },
  });
  const evaluationNumber = formatEvaluationNumber(countThisYear + 1, year);

  const evaluation = await prisma.evaluation.create({
    data: {
      evaluationNumber,
      employeeId: params.employeeId,
      purpose: params.purpose,
      status: "DRAFT",
      primaryAssignmentId: params.primaryAssignmentId ?? null,
      snapshotPositionId: params.snapshotPositionId ?? null,
      createdByAccountId: params.createdByAccountId ?? null,
    },
  });

  await logAudit({
    actorAccountId: params.createdByAccountId ?? null,
    action: "CREATE",
    datasetName: "Evaluation",
    recordId: evaluation.id,
    reason: `Draft ${evaluationNumber} created (purpose: ${params.purpose})`,
  });

  return { id: evaluation.id, evaluationNumber: evaluation.evaluationNumber };
}

// WF-19/LIF-14 note: HR Admin may also create a Manual HR evaluation for
// other authorized needs, reachable from the Evaluation list.
export async function createManualEvaluation(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateManualEvaluation(session)) return "Anda tidak memiliki akses.";

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

// ACC-17: HR Admin alone reviews a Draft, assigns two different P1/P2
// evaluators and releases it — this is the single action every source
// workflow's "send/release evaluation" button calls.
export async function releaseEvaluation(
  evaluationId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canReleaseEvaluation(session)) return "Anda tidak memiliki akses.";

  const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) return "Evaluasi tidak ditemukan.";
  if (!canReleaseEvaluationStatus(evaluation.status)) return "Evaluasi ini sudah diproses.";

  const p1EmployeeId = (formData.get("p1EmployeeId") as string) || "";
  const p2EmployeeId = (formData.get("p2EmployeeId") as string) || "";
  if (!p1EmployeeId || !p2EmployeeId) return "P1 dan P2 wajib dipilih.";
  if (p1EmployeeId === p2EmployeeId) return "P1 dan P2 harus dua orang yang berbeda.";

  const [p1, p2] = await Promise.all([
    prisma.employee.findUnique({ where: { id: p1EmployeeId } }),
    prisma.employee.findUnique({ where: { id: p2EmployeeId } }),
  ]);
  if (!p1 || !p2) return "P1 atau P2 tidak ditemukan.";

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
      p2EmployeeId,
      p2PositionId: p2.currentPositionId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Evaluation",
    recordId: evaluationId,
    reason: `Released ${evaluation.evaluationNumber} to P1=${p1EmployeeId}, P2=${p2EmployeeId}`,
  });

  revalidatePath(`/evaluations/${evaluationId}`);
  revalidatePath("/evaluations");
  revalidatePath("/contracts");
  revalidatePath("/movements");
}

function parseEvaluationScores(formData: FormData): { scores: Prisma.InputJsonValue; total: number } {
  const parseScore = (name: string): number | undefined => {
    const raw = (formData.get(name) as string)?.trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return isValidScoreValue(n) ? n : undefined;
  };

  const useKpi = formData.get("useKpi") === "on" || formData.get("useKpi") === "true";
  const companyValues = ["companyValue1", "companyValue2", "companyValue3", "companyValue4", "companyValue5"]
    .map(parseScore)
    .filter((v): v is number => typeof v === "number");

  const rawScores: EvaluationScores = useKpi
    ? {
        kpiProductivity: parseScore("kpiProductivity"),
        absensi: parseScore("absensi"),
        tugasKhusus: parseScore("tugasKhusus"),
        sp: parseScore("sp"),
        kompetensi: parseScore("kompetensi"),
        companyValues,
      }
    : {
        qualityOrientation: parseScore("qualityOrientation"),
        problemSolving: parseScore("problemSolving"),
        communicationLeadership: parseScore("communicationLeadership"),
        technicalExpertise: parseScore("technicalExpertise"),
        workDiscipline: parseScore("workDiscipline"),
        absensi: parseScore("absensi"),
        tugasKhusus: parseScore("tugasKhusus"),
        sp: parseScore("sp"),
        kompetensi: parseScore("kompetensi"),
        companyValues,
      };

  const total = computeEvaluationTotal(rawScores);
  // Strips undefined-valued keys — Prisma's Json scalar requires a plain
  // JSON-serializable value, and JSON.stringify already drops `undefined`.
  const scores = JSON.parse(JSON.stringify(rawScores)) as Prisma.InputJsonValue;
  return { scores, total };
}

// ACC-17: each evaluator submits only their own assigned slot. When both
// slots are in, the Evaluation moves straight to Completed — no separate
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

  const { scores, total } = parseEvaluationScores(formData);
  const evaluator = await prisma.employee.findUnique({ where: { id: session.user.employeeId! } });

  const otherSlotSubmittedAt = slot === "P1" ? evaluation.p2SubmittedAt : evaluation.p1SubmittedAt;
  const now = new Date();
  const bothNowDone = !!otherSlotSubmittedAt;

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

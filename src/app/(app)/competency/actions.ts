"use server";

import { revalidatePath } from "next/cache";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canOpenCompetencyCycle, canReassignCompetencyEvaluator, canScoreAsCompetencyP1 } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  formatCycleCode,
  computeCompetencyAchievementPct,
  computeCompanyValuesScore,
  isValidCompanyValueScore,
} from "@/lib/competency";
import { resolveCompetencyEvaluators } from "@/lib/competency-routing";
import type { EvaluatorSlot } from "@/generated/prisma/enums";

// COM-06/COM-08/COM-17: opening a cycle snapshots every active Employee's
// Primary Position, organization, competency requirements (Job-scoped,
// isRequired items only — COM-04/DM-43) and the same five Company Values,
// plus resolves P1 per COM-15 (P2 dropped — see lib/competency-routing.ts)
// — all frozen at this moment so later master-data edits never rewrite an
// open or completed cycle's results.
export async function openCompetencyCycle(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canOpenCompetencyCycle(session)) return "Anda tidak memiliki akses.";

  const periodLabel = (formData.get("periodLabel") as string)?.trim();
  const startDateRaw = formData.get("startDate") as string;
  const cutoffDateRaw = (formData.get("cutoffDate") as string) || startDateRaw;
  const endDateRaw = formData.get("endDate") as string | null;

  if (!periodLabel || !startDateRaw) return "Label periode dan tanggal mulai wajib diisi.";

  const startDate = new Date(startDateRaw);
  const cutoffDate = new Date(cutoffDateRaw);
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

  const openCycleExists = await prisma.competencyAssessmentCycle.findFirst({
    where: { status: "OPEN", isHistorical: false },
  });
  if (openCycleExists) {
    return `Sudah ada siklus aktif (${openCycleExists.periodLabel}) — tutup siklus tersebut terlebih dahulu sebelum membuka yang baru.`;
  }

  const [competencyFrameworkVersion, companyValueFrameworkVersion] = await Promise.all([
    prisma.competencyFrameworkVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { effectiveFrom: "desc" } }),
    prisma.companyValueFrameworkVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  if (!competencyFrameworkVersion || !companyValueFrameworkVersion) {
    return "Belum ada Kerangka Kompetensi atau Tata Nilai aktif — muat dokumen sumber terlebih dahulu.";
  }

  const companyValueDefinitions = await prisma.companyValueDefinition.findMany({
    where: { frameworkVersionId: companyValueFrameworkVersion.id },
    orderBy: { displayOrder: "asc" },
  });
  if (companyValueDefinitions.length !== 5) {
    return `Tata Nilai aktif harus memiliki tepat 5 nilai (ditemukan ${companyValueDefinitions.length}).`;
  }

  const requirements = await prisma.positionCompetencyRequirement.findMany({
    where: { isRequired: true, competencyDefinition: { frameworkVersionId: competencyFrameworkVersion.id } },
    include: { competencyDefinition: true },
  });
  const requirementsByJobId = new Map<string, typeof requirements>();
  for (const req of requirements) {
    const list = requirementsByJobId.get(req.jobId) ?? [];
    list.push(req);
    requirementsByJobId.set(req.jobId, list);
  }

  const employees = await prisma.employee.findMany({
    where: {
      activeFlag: true,
      assignments: {
        some: {
          status: "ACTIVE",
          primaryAssignmentFlag: true,
          effectiveFrom: { lte: cutoffDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: cutoffDate } }],
        },
      },
    },
    include: {
      assignments: {
        where: {
          status: "ACTIVE",
          primaryAssignmentFlag: true,
          effectiveFrom: { lte: cutoffDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: cutoffDate } }],
        },
        include: { position: { include: { job: true } } },
        take: 1,
      },
    },
  });

  const year = companyYear(startDate);
  const seq = await nextSequence(`CYC-${year}`);
  const cycleCode = formatCycleCode(seq, year);

  const cycle = await prisma.competencyAssessmentCycle.create({
    data: {
      cycleCode,
      periodLabel,
      cutoffDate,
      startDate,
      endDate,
      competencyFrameworkVersionId: competencyFrameworkVersion.id,
      companyValueFrameworkVersionId: companyValueFrameworkVersion.id,
      status: "OPEN",
      isHistorical: false,
      openedByAccountId: session.user.id,
    },
  });

  let createdCount = 0;
  for (const employee of employees) {
    const primaryAssignment = employee.assignments[0];
    if (!primaryAssignment) continue;
    const position = primaryAssignment.position;

    const evaluators = await resolveCompetencyEvaluators(position.id, cutoffDate);
    const jobRequirements = requirementsByJobId.get(position.jobId) ?? [];

    await prisma.competencyAssessment.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        primaryAssignmentId: primaryAssignment.id,
        positionId: position.id,
        jobId: position.jobId,
        orgUnitId: position.orgUnitId,
        isLevel3AtSnapshot: evaluators.isLevel3,
        p1EmployeeId: evaluators.p1?.employeeId ?? null,
        p1PositionId: evaluators.p1?.positionId ?? null,
        items: {
          create: jobRequirements.map((req) => ({
            competencyDefinitionId: req.competencyDefinitionId,
            competencyNameSnapshot: req.competencyDefinition.name,
            categorySnapshot: req.competencyDefinition.category,
            isRequired: true,
            requiredLevel: req.targetLevel,
          })),
        },
        valueItems: {
          create: companyValueDefinitions.map((v) => ({
            companyValueDefinitionId: v.id,
            valueNameSnapshot: v.name,
            weightSnapshot: v.weight,
          })),
        },
      },
    });
    createdCount++;
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "CompetencyAssessmentCycle",
    recordId: cycle.id,
    reason: `Opened cycle ${cycleCode} (${periodLabel}) with ${createdCount} assessment(s)`,
  });

  revalidatePath("/competency");
  redirect(`/competency/cycles/${cycle.id}`);
}

export async function closeCompetencyCycle(cycleId: string, _prevState: string | undefined): Promise<string | undefined> {
  const session = await requireSession();
  if (!canOpenCompetencyCycle(session)) return "Anda tidak memiliki akses.";

  const cycle = await prisma.competencyAssessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return "Siklus tidak ditemukan.";
  if (cycle.status !== "OPEN") return "Siklus ini sudah ditutup.";

  await prisma.competencyAssessmentCycle.update({ where: { id: cycleId }, data: { status: "CLOSED", closedAt: new Date() } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "CompetencyAssessmentCycle",
    recordId: cycleId,
    reason: `Closed cycle ${cycle.cycleCode}`,
  });

  revalidatePath("/competency");
  revalidatePath(`/competency/cycles/${cycleId}`);
  redirect(`/competency/cycles/${cycleId}`);
}

// ACC-21/COM-15: HR Admin-only P1/P2 reassignment with a mandatory reason
// and full audit history. Reassigning an already-submitted slot voids that
// slot's submission only (clears the timestamp and any scores already
// entered under it) — the other slot is untouched.
export async function reassignCompetencyEvaluator(
  assessmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canReassignCompetencyEvaluator(session)) return "Anda tidak memiliki akses.";

  const slot = formData.get("slot") as EvaluatorSlot;
  const newEmployeeId = (formData.get("newEmployeeId") as string)?.trim();
  const reason = (formData.get("reason") as string)?.trim();

  if (slot !== "P1" && slot !== "P2") return "Slot tidak valid.";
  if (!newEmployeeId) return "Karyawan pengganti wajib dipilih.";
  if (!reason) return "Alasan penggantian wajib diisi.";

  const assessment = await prisma.competencyAssessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return "Penilaian tidak ditemukan.";

  const newEmployee = await prisma.employee.findUnique({ where: { id: newEmployeeId } });
  if (!newEmployee) return "Karyawan pengganti tidak ditemukan.";

  const oldEmployeeId = slot === "P1" ? assessment.p1EmployeeId : assessment.p2EmployeeId;

  await prisma.$transaction(async (tx) => {
    if (slot === "P1") {
      await tx.competencyAssessment.update({
        where: { id: assessmentId },
        data: { p1EmployeeId: newEmployeeId, p1SubmittedAt: null, competencyAchievementPct: null, completedAt: null },
      });
      // Voiding P1's submission also voids the levels P1 already scored and
      // P1's Company Values scores — the new P1 starts from a clean slate.
      await tx.competencyAssessmentItem.updateMany({ where: { assessmentId }, data: { actualLevel: null } });
      await tx.companyValueAssessmentItem.updateMany({ where: { assessmentId }, data: { p1Score: null, p1Comment: null } });
    } else {
      await tx.competencyAssessment.update({
        where: { id: assessmentId },
        data: { p2EmployeeId: newEmployeeId, p2SubmittedAt: null, companyValuesScore: null, completedAt: null },
      });
      await tx.companyValueAssessmentItem.updateMany({ where: { assessmentId }, data: { p2Score: null, p2Comment: null } });
    }

    await tx.competencyEvaluatorChange.create({
      data: {
        assessmentId,
        slot,
        oldEmployeeId,
        newEmployeeId,
        reason,
        changedByAccountId: session.user.id,
      },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "CompetencyAssessment",
    recordId: assessmentId,
    reason: `Reassigned ${slot} to ${newEmployee.fullLegalName}: ${reason}`,
  });

  revalidatePath(`/competency/assessments/${assessmentId}`);
  redirect(`/competency/assessments/${assessmentId}`);
}

// COM-06/ACC-21: P1 records Primary-Position competency Actual levels (0-5)
// AND Company Values. One-time submission — a resubmit is only possible
// after HR Admin reassigns the slot (reassignCompetencyEvaluator voids it).
export async function submitP1Assessment(
  assessmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const assessment = await prisma.competencyAssessment.findUnique({
    where: { id: assessmentId },
    include: { items: true, valueItems: true },
  });
  if (!assessment) return "Penilaian tidak ditemukan.";
  if (!canScoreAsCompetencyP1(session.user.employeeId, assessment.p1EmployeeId)) return "Anda tidak memiliki akses.";
  if (assessment.p1SubmittedAt) return "Penilaian P1 sudah dikirim.";

  const itemUpdates: { id: string; actualLevel: number }[] = [];
  for (const item of assessment.items) {
    const raw = formData.get(`actual_${item.id}`) as string | null;
    const level = raw !== null && raw !== "" ? Number(raw) : NaN;
    if (Number.isNaN(level) || level < 0 || level > 5) return `Level aktual untuk "${item.competencyNameSnapshot}" wajib diisi (0-5).`;
    itemUpdates.push({ id: item.id, actualLevel: level });
  }

  const valueUpdates: { id: string; score: number }[] = [];
  for (const v of assessment.valueItems) {
    const raw = formData.get(`p1score_${v.id}`) as string | null;
    const score = raw !== null && raw !== "" ? Number(raw) : NaN;
    if (Number.isNaN(score) || !isValidCompanyValueScore(score)) return `Skor Tata Nilai "${v.valueNameSnapshot}" wajib dipilih.`;
    valueUpdates.push({ id: v.id, score });
  }

  const now = new Date();
  const competencyAchievementPct = computeCompetencyAchievementPct(
    assessment.items.map((item) => ({
      isRequired: item.isRequired,
      requiredLevel: item.requiredLevel,
      actualLevel: itemUpdates.find((u) => u.id === item.id)?.actualLevel ?? item.actualLevel,
    }))
  );
  // P1's submission alone completes the assessment now (P2 dropped — see
  // lib/competency.ts), so this is unconditional rather than gated on a
  // second submission arriving later.
  const companyValuesScore = computeCompanyValuesScore(
    assessment.valueItems.map((v) => ({
      p1Score: valueUpdates.find((u) => u.id === v.id)?.score ?? null,
      weightSnapshot: v.weightSnapshot,
    }))
  );

  await prisma.$transaction(async (tx) => {
    for (const u of itemUpdates) {
      await tx.competencyAssessmentItem.update({ where: { id: u.id }, data: { actualLevel: u.actualLevel } });
    }
    for (const u of valueUpdates) {
      await tx.companyValueAssessmentItem.update({ where: { id: u.id }, data: { p1Score: u.score } });
    }
    await tx.competencyAssessment.update({
      where: { id: assessmentId },
      data: {
        p1SubmittedAt: now,
        competencyAchievementPct,
        companyValuesScore,
        completedAt: now,
      },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "CompetencyAssessment",
    recordId: assessmentId,
    reason: "P1 submitted competency levels and Company Values",
  });

  revalidatePath(`/competency/assessments/${assessmentId}`);
  redirect(`/competency/assessments/${assessmentId}`);
}

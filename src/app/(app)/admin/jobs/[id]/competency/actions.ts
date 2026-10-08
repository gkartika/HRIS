"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageCompetencyFramework } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// COM-05 (documented simplification): requirements are configured per Job,
// not per individual Position seat — see docs/DECISIONS.md. One row per
// (jobId, competencyDefinitionId); isRequired=false is the sole N/A
// representation (DM-43), never a target level of 0.
export async function saveJobCompetencyRequirements(
  jobId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageCompetencyFramework(session)) return t("common.forbidden");

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return "Jabatan tidak ditemukan.";

  const definitions = await prisma.competencyDefinition.findMany({
    where: { activeFlag: true, frameworkVersion: { status: "ACTIVE" } },
    select: { id: true },
  });

  let changedCount = 0;
  for (const def of definitions) {
    const isRequired = formData.get(`required_${def.id}`) === "on";
    const rawLevel = formData.get(`level_${def.id}`) as string | null;
    const targetLevel = isRequired && rawLevel ? Number(rawLevel) : null;

    if (isRequired && targetLevel !== null && (targetLevel < 1 || targetLevel > 5)) {
      return `Level yang disyaratkan harus antara 1-5.`;
    }

    const existing = await prisma.positionCompetencyRequirement.findUnique({
      where: { jobId_competencyDefinitionId: { jobId, competencyDefinitionId: def.id } },
    });

    if (!existing && !isRequired) continue; // never existed, still not required — nothing to write
    if (existing && existing.isRequired === isRequired && existing.targetLevel === targetLevel) continue;

    await prisma.positionCompetencyRequirement.upsert({
      where: { jobId_competencyDefinitionId: { jobId, competencyDefinitionId: def.id } },
      update: { isRequired, targetLevel, updatedByAccountId: session.user.id },
      create: { jobId, competencyDefinitionId: def.id, isRequired, targetLevel, updatedByAccountId: session.user.id },
    });
    changedCount++;
  }

  if (changedCount > 0) {
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "PositionCompetencyRequirement",
      recordId: jobId,
      reason: `Updated ${changedCount} competency requirement(s) for job ${job.jobTitle}`,
    });
  }

  revalidatePath(`/admin/jobs/${jobId}/competency`);
  redirect(`/admin/jobs/${jobId}/competency?saved=1`);
}

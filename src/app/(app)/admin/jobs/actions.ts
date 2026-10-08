"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { PositionType } from "@/generated/prisma/enums";

export async function createJob(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return t("common.forbidden");

  const jobCode = (formData.get("jobCode") as string)?.trim();
  const jobTitle = (formData.get("jobTitle") as string)?.trim();
  const jobPurpose = (formData.get("jobPurpose") as string)?.trim() || null;

  if (!jobCode || !jobTitle) {
    return "Kode dan nama jabatan wajib diisi.";
  }

  const existing = await prisma.job.findUnique({ where: { jobCode } });
  if (existing) return `Kode jabatan ${jobCode} sudah digunakan.`;

  const job = await prisma.job.create({
    data: { jobCode, jobTitle, jobPurpose },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Job",
    recordId: job.id,
    reason: `Created job ${jobTitle} (${jobCode})`,
  });

  revalidatePath("/admin/jobs");
  redirect("/admin/jobs");
}

export async function updateJob(
  jobId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return t("common.forbidden");

  const jobTitle = (formData.get("jobTitle") as string)?.trim();
  const jobPurpose = (formData.get("jobPurpose") as string)?.trim() || null;
  const approvalStatus = (formData.get("approvalStatus") as string)?.trim();
  const defaultOrgUnitId = (formData.get("defaultOrgUnitId") as string) || null;
  const defaultPositionType = ((formData.get("defaultPositionType") as string) || null) as PositionType | null;

  if (!jobTitle) return "Nama jabatan wajib diisi.";

  await prisma.job.update({
    where: { id: jobId },
    data: { jobTitle, jobPurpose, approvalStatus, defaultOrgUnitId, defaultPositionType },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Job",
    recordId: jobId,
    reason: `Updated job ${jobTitle}`,
  });

  revalidatePath("/admin/jobs");
  redirect("/admin/jobs");
}

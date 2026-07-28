"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createJob(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const jobCode = (formData.get("jobCode") as string)?.trim();
  const jobTitle = (formData.get("jobTitle") as string)?.trim();
  const jobLevel = (formData.get("jobLevel") as string)?.trim();
  const jobPurpose = (formData.get("jobPurpose") as string)?.trim() || null;

  if (!jobCode || !jobTitle || !jobLevel) {
    return "Kode, nama, dan level jabatan wajib diisi.";
  }

  const existing = await prisma.job.findUnique({ where: { jobCode } });
  if (existing) return `Kode jabatan ${jobCode} sudah digunakan.`;

  const job = await prisma.job.create({
    data: { jobCode, jobTitle, jobLevel, jobPurpose },
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
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const jobTitle = (formData.get("jobTitle") as string)?.trim();
  const jobLevel = (formData.get("jobLevel") as string)?.trim();
  const jobPurpose = (formData.get("jobPurpose") as string)?.trim() || null;
  const approvalStatus = (formData.get("approvalStatus") as string)?.trim();

  if (!jobTitle || !jobLevel) return "Nama dan level jabatan wajib diisi.";

  await prisma.job.update({
    where: { id: jobId },
    data: { jobTitle, jobLevel, jobPurpose, approvalStatus },
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

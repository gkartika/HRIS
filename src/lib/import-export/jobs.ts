import { prisma } from "@/lib/db";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Jabatan Standar";
export const templateHeaders = ["jobCode", "jobTitle", "jobPurpose"];
export const templateExampleRow = {
  jobCode: "JOB-CONTOH",
  jobTitle: "Staf Contoh",
  jobPurpose: "Deskripsi singkat tujuan jabatan.",
};

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const existing = await prisma.job.findMany({ select: { id: true, jobCode: true } });
  const existingByCode = new Map(existing.map((j) => [j.jobCode, j.id]));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const jobCode = raw.jobCode?.trim();
    const jobTitle = raw.jobTitle?.trim();

    const reasons: string[] = [];
    if (!jobCode) reasons.push("Kode jabatan (jobCode) wajib diisi");
    else if (seenInFile.has(jobCode)) reasons.push(`Kode jabatan ${jobCode} duplikat dalam berkas`);
    if (!jobTitle) reasons.push("Nama jabatan (jobTitle) wajib diisi");

    if (jobCode) seenInFile.add(jobCode);
    const existingId = jobCode ? existingByCode.get(jobCode) : undefined;

    return {
      rowNumber,
      raw,
      isValid: reasons.length === 0,
      rejectionReason: reasons.length > 0 ? reasons.join("; ") : null,
      action: reasons.length > 0 ? null : existingId ? "UPDATE" : "CREATE",
      existingId,
    };
  });
}

export async function commitRow(raw: Record<string, string>): Promise<CommitResult> {
  const jobCode = raw.jobCode.trim();
  const data = {
    jobTitle: raw.jobTitle.trim(),
    jobPurpose: raw.jobPurpose?.trim() || null,
  };

  const existing = await prisma.job.findUnique({ where: { jobCode } });
  if (existing) {
    await prisma.job.update({ where: { id: existing.id }, data });
    return { id: existing.id, action: "UPDATE" };
  }

  const created = await prisma.job.create({ data: { jobCode, ...data } });
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const jobs = await prisma.job.findMany({ orderBy: { jobCode: "asc" } });
  return {
    headers: templateHeaders,
    rows: jobs.map((j) => ({
      jobCode: j.jobCode,
      jobTitle: j.jobTitle,
      jobPurpose: j.jobPurpose ?? "",
    })),
  };
}

import { prisma } from "@/lib/db";
import { JOB_APPROVAL_STATUSES } from "@/lib/job";
import { POSITION_TYPES } from "@/lib/position-type";
import type { PositionType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Jabatan Standar";
// defaultOrgUnitCode/defaultPositionType/approvalStatus are optional — same
// "Default untuk Posisi Baru" fields as admin/jobs/[id]/edit-form.tsx, blank
// is a valid answer (no default set / leave approvalStatus unchanged).
export const templateHeaders = [
  "jobCode",
  "jobTitle",
  "jobPurpose",
  "approvalStatus",
  "defaultOrgUnitCode",
  "defaultPositionType",
];
export const templateExampleRow = {
  jobCode: "JOB-CONTOH",
  jobTitle: "Staf Contoh",
  jobPurpose: "Deskripsi singkat tujuan jabatan.",
  approvalStatus: "Active",
  defaultOrgUnitCode: "",
  defaultPositionType: "",
};

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const [existing, orgUnits] = await Promise.all([
    prisma.job.findMany({ select: { id: true, jobCode: true } }),
    prisma.orgUnit.findMany({ select: { unitCode: true } }),
  ]);
  const existingByCode = new Map(existing.map((j) => [j.jobCode, j.id]));
  const orgUnitCodes = new Set(orgUnits.map((u) => u.unitCode));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const jobCode = raw.jobCode?.trim();
    const jobTitle = raw.jobTitle?.trim();
    const approvalStatus = raw.approvalStatus?.trim();
    const defaultOrgUnitCode = raw.defaultOrgUnitCode?.trim();
    const defaultPositionType = raw.defaultPositionType?.trim().toUpperCase();

    const reasons: string[] = [];
    if (!jobCode) reasons.push("Kode jabatan (jobCode) wajib diisi");
    else if (seenInFile.has(jobCode)) reasons.push(`Kode jabatan ${jobCode} duplikat dalam berkas`);
    if (!jobTitle) reasons.push("Nama jabatan (jobTitle) wajib diisi");
    if (approvalStatus && !JOB_APPROVAL_STATUSES.includes(approvalStatus)) {
      reasons.push(`Status Persetujuan (approvalStatus) harus salah satu dari: ${JOB_APPROVAL_STATUSES.join(", ")}`);
    }
    if (defaultOrgUnitCode && !orgUnitCodes.has(defaultOrgUnitCode)) {
      reasons.push(`Unit Organisasi Default (defaultOrgUnitCode) "${defaultOrgUnitCode}" tidak ditemukan`);
    }
    if (defaultPositionType && !POSITION_TYPES.includes(defaultPositionType as PositionType)) {
      reasons.push(`Jenis Posisi Default (defaultPositionType) harus salah satu dari: ${POSITION_TYPES.join(", ")}`);
    }

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
  const approvalStatus = raw.approvalStatus?.trim() || undefined;
  const defaultOrgUnitCode = raw.defaultOrgUnitCode?.trim();
  const defaultPositionType = raw.defaultPositionType?.trim().toUpperCase() || null;

  const defaultOrgUnit = defaultOrgUnitCode
    ? await prisma.orgUnit.findUnique({ where: { unitCode: defaultOrgUnitCode } })
    : null;

  const data = {
    jobTitle: raw.jobTitle.trim(),
    jobPurpose: raw.jobPurpose?.trim() || null,
    // Blank approvalStatus means "leave as is" — the column has no null
    // state to clear it to (schema default applies only on CREATE, below).
    ...(approvalStatus ? { approvalStatus } : {}),
    defaultOrgUnitId: defaultOrgUnit?.id ?? null,
    defaultPositionType: (defaultPositionType || null) as PositionType | null,
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
  const jobs = await prisma.job.findMany({
    include: { defaultOrgUnit: { select: { unitCode: true } } },
    orderBy: { jobCode: "asc" },
  });
  return {
    headers: templateHeaders,
    rows: jobs.map((j) => ({
      jobCode: j.jobCode,
      jobTitle: j.jobTitle,
      jobPurpose: j.jobPurpose ?? "",
      approvalStatus: j.approvalStatus,
      defaultOrgUnitCode: j.defaultOrgUnit?.unitCode ?? "",
      defaultPositionType: j.defaultPositionType ?? "",
    })),
  };
}

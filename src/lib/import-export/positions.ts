import { prisma } from "@/lib/db";
import type { PositionType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Posisi Organisasi";
export const templateHeaders = [
  "positionCode",
  "jobCode",
  "jobLevel",
  "orgUnitCode",
  "positionType",
  "approvedFte",
  "reportsToPositionCode",
];
export const templateExampleRow = {
  positionCode: "POS-CONTOH-01",
  jobCode: "JOB-CONTOH",
  jobLevel: "2A",
  orgUnitCode: "DEPT-CONTOH",
  positionType: "STAFF",
  approvedFte: "1",
  reportsToPositionCode: "",
};

const VALID_POSITION_TYPES = ["STAFF", "TEAM_LEAD", "SECTION_HEAD", "DEPARTMENT_HEAD", "DIRECTOR"];

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const [existingPositions, jobs, orgUnits] = await Promise.all([
    prisma.position.findMany({ select: { id: true, positionCode: true } }),
    prisma.job.findMany({ select: { id: true, jobCode: true } }),
    prisma.orgUnit.findMany({ select: { id: true, unitCode: true } }),
  ]);
  const positionByCode = new Map(existingPositions.map((p) => [p.positionCode, p.id]));
  const jobByCode = new Map(jobs.map((j) => [j.jobCode, j.id]));
  const orgUnitByCode = new Map(orgUnits.map((u) => [u.unitCode, u.id]));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const positionCode = raw.positionCode?.trim();
    const jobCode = raw.jobCode?.trim();
    const jobLevel = raw.jobLevel?.trim();
    const orgUnitCode = raw.orgUnitCode?.trim();
    const positionType = raw.positionType?.trim().toUpperCase();
    const approvedFte = raw.approvedFte?.trim();
    const reportsToPositionCode = raw.reportsToPositionCode?.trim();

    const reasons: string[] = [];
    if (!positionCode) reasons.push("Kode posisi (positionCode) wajib diisi");
    else if (seenInFile.has(positionCode)) reasons.push(`Kode posisi ${positionCode} duplikat dalam berkas`);
    if (!jobCode || !jobByCode.has(jobCode)) reasons.push(`Jabatan (jobCode) "${jobCode}" tidak ditemukan`);
    if (!jobLevel) reasons.push("Level (jobLevel) wajib diisi");
    if (!orgUnitCode || !orgUnitByCode.has(orgUnitCode)) {
      reasons.push(`Unit organisasi (orgUnitCode) "${orgUnitCode}" tidak ditemukan`);
    }
    if (!positionType || !VALID_POSITION_TYPES.includes(positionType)) {
      reasons.push(`Jenis posisi (positionType) harus salah satu dari: ${VALID_POSITION_TYPES.join(", ")}`);
    }
    if (approvedFte && (Number.isNaN(Number(approvedFte)) || Number(approvedFte) <= 0)) {
      reasons.push("FTE Disetujui (approvedFte) harus berupa angka lebih dari 0");
    }
    if (reportsToPositionCode) {
      if (reportsToPositionCode === positionCode) {
        reasons.push("Posisi tidak dapat melapor ke dirinya sendiri");
      } else if (!positionByCode.has(reportsToPositionCode) && !seenInFile.has(reportsToPositionCode)) {
        reasons.push(`Melapor ke (reportsToPositionCode) "${reportsToPositionCode}" tidak ditemukan`);
      }
    }

    if (positionCode) seenInFile.add(positionCode);
    const existingId = positionCode ? positionByCode.get(positionCode) : undefined;

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
  const positionCode = raw.positionCode.trim();
  const job = await prisma.job.findUniqueOrThrow({ where: { jobCode: raw.jobCode.trim() } });
  const orgUnit = await prisma.orgUnit.findUniqueOrThrow({ where: { unitCode: raw.orgUnitCode.trim() } });
  const reportsToCode = raw.reportsToPositionCode?.trim() || null;
  const [existing, reportsTo] = await Promise.all([
    prisma.position.findUnique({ where: { positionCode } }),
    reportsToCode ? prisma.position.findUnique({ where: { positionCode: reportsToCode } }) : null,
  ]);
  const approvedFte = raw.approvedFte?.trim() ? Number(raw.approvedFte.trim()) : 1;

  const data = {
    jobId: job.id,
    jobLevel: raw.jobLevel.trim(),
    orgUnitId: orgUnit.id,
    positionType: raw.positionType.trim().toUpperCase() as PositionType,
    approvedFte,
    reportsToPositionId: reportsTo?.id ?? null,
  };

  if (existing) {
    await prisma.position.update({ where: { id: existing.id }, data });
    return { id: existing.id, action: "UPDATE" };
  }

  const created = await prisma.position.create({
    data: { positionCode, positionStatus: "VACANT", ...data },
  });
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const positions = await prisma.position.findMany({
    include: { job: true, orgUnit: true, reportsToPosition: true },
    orderBy: { positionCode: "asc" },
  });
  return {
    headers: templateHeaders,
    rows: positions.map((p) => ({
      positionCode: p.positionCode,
      jobCode: p.job.jobCode,
      jobLevel: p.jobLevel,
      orgUnitCode: p.orgUnit.unitCode,
      positionType: p.positionType,
      approvedFte: String(p.approvedFte),
      reportsToPositionCode: p.reportsToPosition?.positionCode ?? "",
    })),
  };
}

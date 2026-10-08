import { prisma } from "@/lib/db";
import { POSITION_TYPES } from "@/lib/position-type";
import type { PositionType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import { parseReportsTo, parseYesNo, singleHrManagerViolations } from "./position-rules";

export const label = "Posisi Organisasi";
// Status Posisi is no longer a column: it is always derived from whether the
// seat has an active placement (Kosong/Terisi). An older file that still has
// a positionStatus column is accepted; the column is ignored.
export const templateHeaders = [
  "positionCode",
  "jobCode",
  "jobLevel",
  "orgUnitCode",
  "positionType",
  "reportsToPositionCode",
  "grantsHrManagerAccess",
];
export const templateExampleRow = {
  positionCode: "POS-CONTOH-01",
  jobCode: "JOB-CONTOH",
  jobLevel: "2A",
  orgUnitCode: "DEPT-CONTOH",
  positionType: "STAFF",
  // Blank keeps the current line manager on update (none on a new position);
  // KOSONGKAN removes it.
  reportsToPositionCode: "",
  grantsHrManagerAccess: "",
};

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const [existingPositions, jobs, orgUnits] = await Promise.all([
    prisma.position.findMany({ select: { id: true, positionCode: true, grantsHrManagerAccess: true } }),
    prisma.job.findMany({ select: { id: true, jobCode: true } }),
    prisma.orgUnit.findMany({ select: { id: true, unitCode: true } }),
  ]);
  const positionByCode = new Map(existingPositions.map((p) => [p.positionCode, p.id]));
  const jobByCode = new Map(jobs.map((j) => [j.jobCode, j.id]));
  const orgUnitByCode = new Map(orgUnits.map((u) => [u.unitCode, u.id]));
  const firstRowOfCode = new Map<string, number>();
  rows.forEach((raw, index) => {
    const code = raw.positionCode?.trim();
    if (code && !firstRowOfCode.has(code)) firstRowOfCode.set(code, index);
  });
  const seenInFile = new Set<string>();

  // Pass 1: every rule that only looks at the row itself and at earlier rows.
  const reasonsByRow = rows.map((raw, index) => {
    const positionCode = raw.positionCode?.trim();
    const jobCode = raw.jobCode?.trim();
    const jobLevel = raw.jobLevel?.trim();
    const orgUnitCode = raw.orgUnitCode?.trim();
    const positionType = raw.positionType?.trim().toUpperCase();
    const reportsTo = parseReportsTo(raw.reportsToPositionCode);
    const grantsHrManagerAccess = raw.grantsHrManagerAccess?.trim();

    const reasons: string[] = [];
    if (!positionCode) reasons.push("Kode posisi (positionCode) wajib diisi");
    else if (seenInFile.has(positionCode)) reasons.push(`Kode posisi ${positionCode} duplikat dalam berkas`);
    if (!jobCode || !jobByCode.has(jobCode)) reasons.push(`Jabatan (jobCode) "${jobCode}" tidak ditemukan`);
    if (!jobLevel) reasons.push("Level (jobLevel) wajib diisi");
    if (!orgUnitCode || !orgUnitByCode.has(orgUnitCode)) {
      reasons.push(`Unit organisasi (orgUnitCode) "${orgUnitCode}" tidak ditemukan`);
    }
    if (!positionType || !POSITION_TYPES.includes(positionType as PositionType)) {
      reasons.push(`Jenis posisi (positionType) harus salah satu dari: ${POSITION_TYPES.join(", ")}`);
    }
    if (reportsTo.kind === "SET") {
      const parentCode = reportsTo.positionCode;
      const parentRow = firstRowOfCode.get(parentCode);
      if (parentCode === positionCode) {
        reasons.push("Posisi tidak dapat melapor ke dirinya sendiri");
      } else if (!positionByCode.has(parentCode) && !seenInFile.has(parentCode)) {
        reasons.push(
          parentRow !== undefined && parentRow > index
            ? `Posisi atasan "${parentCode}" baru dibuat di baris ${parentRow + 2}; pindahkan baris itu ke atas baris ini`
            : `Melapor ke (reportsToPositionCode) "${parentCode}" tidak ditemukan`
        );
      }
    }
    if (grantsHrManagerAccess && parseYesNo(grantsHrManagerAccess) === null) {
      reasons.push('Akses HR Manager (grantsHrManagerAccess) harus "Ya" atau "Tidak"');
    }

    if (positionCode) seenInFile.add(positionCode);
    return reasons;
  });

  // A row whose line manager is a NEW position in this same file can only be
  // posted if that position's own row is posted too; otherwise the line would
  // silently come out empty. Repeated so a rejection carries down a whole
  // chain of new positions.
  const holdChildrenOfRejectedNewPositions = () => {
    let changed = true;
    while (changed) {
      changed = false;
      const rejectedNewCodes = new Set(
        rows
          .map((raw, index) => ({ code: raw.positionCode?.trim(), index }))
          .filter((r) => r.code && !positionByCode.has(r.code) && reasonsByRow[r.index].length > 0)
          .map((r) => r.code as string)
      );
      rows.forEach((raw, index) => {
        const reportsTo = parseReportsTo(raw.reportsToPositionCode);
        if (reasonsByRow[index].length === 0 && reportsTo.kind === "SET" && rejectedNewCodes.has(reportsTo.positionCode)) {
          reasonsByRow[index].push(`Baris posisi atasan "${reportsTo.positionCode}" ditolak, jadi baris ini juga ditahan`);
          changed = true;
        }
      });
    }
  };
  holdChildrenOfRejectedNewPositions();

  // Only one position may hold HR Manager access after the import. Checked
  // against the rows that will really be posted, then the hold-children rule
  // runs again in case a rejected "Ya" row was itself a new line manager.
  const hrViolations = singleHrManagerViolations(
    rows
      .map((raw, index) => ({
        index,
        positionCode: raw.positionCode?.trim() ?? "",
        grantsHrManagerAccess: parseYesNo(raw.grantsHrManagerAccess),
      }))
      .filter((r) => reasonsByRow[r.index].length === 0),
    existingPositions.filter((p) => p.grantsHrManagerAccess).map((p) => p.positionCode)
  );
  for (const [index, reason] of hrViolations) reasonsByRow[index].push(reason);
  holdChildrenOfRejectedNewPositions();

  return rows.map((raw, index) => {
    const reasons = reasonsByRow[index];
    const positionCode = raw.positionCode?.trim();
    const existingId = positionCode ? positionByCode.get(positionCode) : undefined;
    return {
      rowNumber: index + 2,
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
  const reportsTo = parseReportsTo(raw.reportsToPositionCode);
  const [job, orgUnit, existing, parent] = await Promise.all([
    prisma.job.findUniqueOrThrow({ where: { jobCode: raw.jobCode.trim() } }),
    prisma.orgUnit.findUniqueOrThrow({ where: { unitCode: raw.orgUnitCode.trim() } }),
    prisma.position.findUnique({ where: { positionCode } }),
    reportsTo.kind === "SET" ? prisma.position.findUnique({ where: { positionCode: reportsTo.positionCode } }) : null,
  ]);
  const grantsHrManagerAccess = parseYesNo(raw.grantsHrManagerAccess);

  // Blank never clears a line manager; only KOSONGKAN does. A code that has
  // vanished since the preview also leaves the current line untouched.
  const reportsToData =
    reportsTo.kind === "CLEAR"
      ? { reportsToPositionId: null }
      : reportsTo.kind === "SET" && parent
        ? { reportsToPositionId: parent.id }
        : {};

  const data = {
    jobId: job.id,
    jobLevel: raw.jobLevel.trim(),
    orgUnitId: orgUnit.id,
    positionType: raw.positionType.trim().toUpperCase() as PositionType,
    ...reportsToData,
    // Blank leaves grantsHrManagerAccess unchanged on UPDATE (false on create).
    ...(grantsHrManagerAccess !== null ? { grantsHrManagerAccess } : {}),
  };

  if (existing) {
    await prisma.position.update({ where: { id: existing.id }, data });
    return { id: existing.id, action: "UPDATE" };
  }

  const created = await prisma.position.create({
    data: { positionCode, positionStatus: "VACANT", grantsHrManagerAccess: false, ...data },
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
      reportsToPositionCode: p.reportsToPosition?.positionCode ?? "",
      grantsHrManagerAccess: p.grantsHrManagerAccess ? "Ya" : "Tidak",
    })),
  };
}

import { prisma } from "@/lib/db";
import type { AssignmentType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import { isPositionOccupiedByPrimary, syncPositionStatus } from "@/lib/position-occupancy";

export const label = "Penempatan (Assignment)";
export const templateHeaders = ["employeeNumber", "positionCode", "assignmentType", "effectiveFrom", "effectiveTo"];
export const templateExampleRow = {
  employeeNumber: "CBP-0001",
  positionCode: "POS-CONTOH-01",
  assignmentType: "ADDITIONAL",
  effectiveFrom: "2026-01-01",
  effectiveTo: "",
};

const VALID_ASSIGNMENT_TYPES = ["PRIMARY", "ADDITIONAL", "ACTING", "TEMPORARY"];

// Assignment history is append-only (DM-10: never overwrite a movement) —
// every valid row is always a CREATE, never an UPDATE. There is no natural
// key that would identify "the same" assignment row to update.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const [employees, positions, activePrimaries] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, employeeNumber: true } }),
    prisma.position.findMany({ select: { id: true, positionCode: true } }),
    prisma.assignment.findMany({
      where: { assignmentType: "PRIMARY", status: "ACTIVE" },
      include: { position: true, employee: true },
    }),
  ]);
  const employeeByNumber = new Map(employees.map((e) => [e.employeeNumber, e.id]));
  const positionByCode = new Map(positions.map((p) => [p.positionCode, p.id]));
  // DM-07: which position codes already have an active Primary holder, and
  // who — used to flag a conflicting PRIMARY row before it ever reaches commit.
  const occupiedPrimaryPositions = new Map(
    activePrimaries.map((a) => [a.position.positionCode, a.employee.employeeNumber])
  );

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const employeeNumber = raw.employeeNumber?.trim();
    const positionCode = raw.positionCode?.trim();
    const assignmentType = raw.assignmentType?.trim().toUpperCase();
    const effectiveFrom = raw.effectiveFrom?.trim();
    const effectiveTo = raw.effectiveTo?.trim();

    const reasons: string[] = [];
    if (!employeeNumber || !employeeByNumber.has(employeeNumber)) {
      reasons.push(`Karyawan (employeeNumber) "${employeeNumber}" tidak ditemukan`);
    }
    if (!positionCode || !positionByCode.has(positionCode)) {
      reasons.push(`Posisi (positionCode) "${positionCode}" tidak ditemukan`);
    }
    if (!assignmentType || !VALID_ASSIGNMENT_TYPES.includes(assignmentType)) {
      reasons.push(`Jenis penempatan (assignmentType) harus salah satu dari: ${VALID_ASSIGNMENT_TYPES.join(", ")}`);
    }
    if (!effectiveFrom || Number.isNaN(Date.parse(effectiveFrom))) {
      reasons.push("Berlaku Sejak (effectiveFrom) wajib diisi dengan format tanggal yang valid");
    }
    if (effectiveTo && Number.isNaN(Date.parse(effectiveTo))) {
      reasons.push("Berlaku Sampai (effectiveTo) harus berupa tanggal yang valid jika diisi");
    }
    if (assignmentType === "PRIMARY" && positionCode && positionByCode.has(positionCode)) {
      const otherPrimaryHolder = occupiedPrimaryPositions.get(positionCode);
      if (otherPrimaryHolder && otherPrimaryHolder !== employeeNumber) {
        reasons.push(`Posisi ${positionCode} sudah memiliki pemegang Utama aktif (${otherPrimaryHolder})`);
      } else if (employeeNumber) {
        // Claim it for the rest of this file too, so a second PRIMARY row
        // further down targeting the same position is caught even though
        // it isn't in the database yet.
        occupiedPrimaryPositions.set(positionCode, employeeNumber);
      }
    }

    return {
      rowNumber,
      raw,
      isValid: reasons.length === 0,
      rejectionReason: reasons.length > 0 ? reasons.join("; ") : null,
      action: reasons.length > 0 ? null : "CREATE",
    };
  });
}

export async function commitRow(raw: Record<string, string>): Promise<CommitResult> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { employeeNumber: raw.employeeNumber.trim() } });
  const position = await prisma.position.findUniqueOrThrow({ where: { positionCode: raw.positionCode.trim() } });
  const assignmentType = raw.assignmentType.trim().toUpperCase() as AssignmentType;
  const effectiveFrom = new Date(raw.effectiveFrom.trim());
  const effectiveTo = raw.effectiveTo?.trim() ? new Date(raw.effectiveTo.trim()) : null;

  if (assignmentType === "PRIMARY") {
    if (await isPositionOccupiedByPrimary(position.id, employee.id)) {
      throw new Error(`Posisi ${position.positionCode} sudah memiliki pemegang Utama aktif`);
    }
    // Same rule as the Movement action: close the current Primary (if any)
    // before opening the new one, and keep Employee.currentPositionId in sync.
    const currentPrimary = await prisma.assignment.findFirst({
      where: { employeeId: employee.id, assignmentType: "PRIMARY", status: "ACTIVE" },
    });
    if (currentPrimary) {
      await prisma.assignment.update({
        where: { id: currentPrimary.id },
        data: { status: "ENDED", effectiveTo: effectiveFrom },
      });
      await syncPositionStatus(currentPrimary.positionId);
    }
    const created = await prisma.assignment.create({
      data: {
        employeeId: employee.id,
        positionId: position.id,
        assignmentType,
        primaryAssignmentFlag: true,
        status: "ACTIVE",
        effectiveFrom,
        effectiveTo,
      },
    });
    await prisma.employee.update({ where: { id: employee.id }, data: { currentPositionId: position.id } });
    await syncPositionStatus(position.id);
    return { id: created.id, action: "CREATE" };
  }

  const created = await prisma.assignment.create({
    data: {
      employeeId: employee.id,
      positionId: position.id,
      assignmentType,
      primaryAssignmentFlag: false,
      status: "ACTIVE",
      effectiveFrom,
      effectiveTo,
    },
  });
  await syncPositionStatus(position.id);
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const assignments = await prisma.assignment.findMany({
    include: { employee: true, position: true },
    orderBy: { effectiveFrom: "desc" },
  });
  return {
    headers: templateHeaders,
    rows: assignments.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      positionCode: a.position.positionCode,
      assignmentType: a.assignmentType,
      effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: a.effectiveTo ? a.effectiveTo.toISOString().slice(0, 10) : "",
    })),
  };
}

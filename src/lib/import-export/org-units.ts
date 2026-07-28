import { prisma } from "@/lib/db";
import type { UnitType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Unit Organisasi";
export const templateHeaders = ["unitCode", "unitName", "unitType", "parentUnitCode"];
export const templateExampleRow = {
  unitCode: "DEPT-CONTOH",
  unitName: "Departemen Contoh",
  unitType: "DEPARTMENT",
  parentUnitCode: "",
};

const VALID_UNIT_TYPES = ["DEPARTMENT", "SECTION", "GROUP", "TEAM"];

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const existing = await prisma.orgUnit.findMany({ select: { id: true, unitCode: true } });
  const existingByCode = new Map(existing.map((u) => [u.unitCode, u.id]));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const unitCode = raw.unitCode?.trim();
    const unitName = raw.unitName?.trim();
    const unitType = raw.unitType?.trim().toUpperCase();
    const parentUnitCode = raw.parentUnitCode?.trim();

    const reasons: string[] = [];
    if (!unitCode) reasons.push("Kode unit (unitCode) wajib diisi");
    else if (seenInFile.has(unitCode)) reasons.push(`Kode unit ${unitCode} duplikat dalam berkas`);
    if (!unitName) reasons.push("Nama unit (unitName) wajib diisi");
    if (!unitType || !VALID_UNIT_TYPES.includes(unitType)) {
      reasons.push(`Jenis unit (unitType) harus salah satu dari: ${VALID_UNIT_TYPES.join(", ")}`);
    }
    if (parentUnitCode && !existingByCode.has(parentUnitCode) && parentUnitCode !== unitCode) {
      reasons.push(`Induk unit (parentUnitCode) "${parentUnitCode}" tidak ditemukan`);
    }
    if (parentUnitCode && parentUnitCode === unitCode) {
      reasons.push("Unit tidak dapat menjadi induk dirinya sendiri");
    }

    if (unitCode) seenInFile.add(unitCode);
    const existingId = unitCode ? existingByCode.get(unitCode) : undefined;

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
  const unitCode = raw.unitCode.trim();
  const unitType = raw.unitType.trim().toUpperCase() as UnitType;
  const parentUnitCode = raw.parentUnitCode?.trim() || null;
  const [existing, parentUnit] = await Promise.all([
    prisma.orgUnit.findUnique({ where: { unitCode } }),
    parentUnitCode ? prisma.orgUnit.findUnique({ where: { unitCode: parentUnitCode } }) : null,
  ]);

  if (existing) {
    await prisma.orgUnit.update({
      where: { id: existing.id },
      data: { unitName: raw.unitName.trim(), unitType, parentUnitId: parentUnit?.id ?? null },
    });
    return { id: existing.id, action: "UPDATE" };
  }

  const created = await prisma.orgUnit.create({
    data: { unitCode, unitName: raw.unitName.trim(), unitType, parentUnitId: parentUnit?.id ?? null },
  });
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const units = await prisma.orgUnit.findMany({
    include: { parentUnit: true },
    orderBy: { unitCode: "asc" },
  });
  return {
    headers: templateHeaders,
    rows: units.map((u) => ({
      unitCode: u.unitCode,
      unitName: u.unitName,
      unitType: u.unitType,
      parentUnitCode: u.parentUnit?.unitCode ?? "",
    })),
  };
}

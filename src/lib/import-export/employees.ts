import { prisma } from "@/lib/db";
import { validateNoKk } from "@/lib/validation/employee-fields";
import { projectEmployee } from "@/lib/permissions";
import type { Session } from "next-auth";
import type { Gender, EmploymentStatus } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Karyawan (Employee)";
export const templateHeaders = [
  "employeeNumber",
  "fullLegalName",
  "gender",
  "workEmail",
  "mobileNumber",
  "hireDate",
  "employmentStatus",
  "noKk",
  "namaIbuKandung",
  "educationLevelLabel",
  "ptkpStatusCode",
];
export const templateExampleRow = {
  employeeNumber: "CBP-0099",
  fullLegalName: "Nama Contoh",
  gender: "MALE",
  workEmail: "contoh@cbp.demo",
  mobileNumber: "0812-0000-0000",
  hireDate: "2026-01-01",
  employmentStatus: "PKWTT",
  noKk: "",
  namaIbuKandung: "",
  educationLevelLabel: "S1",
  ptkpStatusCode: "TK/0",
};

const VALID_GENDERS = ["MALE", "FEMALE"];
const VALID_EMPLOYMENT_STATUSES = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"];

// CTL-13: create/update upsert by employeeNumber, replacing the Phase 0
// create-only importer. System-generated fields (id, timestamps,
// currentPositionId, bpjsTkFileId/bpjsKesehatanFileId) are never writable via import.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const [existingEmployees, educationLevels, ptkpStatuses] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, employeeNumber: true } }),
    prisma.educationLevel.findMany({ select: { id: true, label: true } }),
    prisma.ptkpStatus.findMany({ select: { code: true } }),
  ]);
  const employeeByNumber = new Map(existingEmployees.map((e) => [e.employeeNumber, e.id]));
  const educationByLabel = new Map(educationLevels.map((l) => [l.label, l.id]));
  const validPtkpCodes = new Set(ptkpStatuses.map((s) => s.code));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const employeeNumber = raw.employeeNumber?.trim();
    const fullLegalName = raw.fullLegalName?.trim();
    const gender = raw.gender?.trim().toUpperCase();
    const hireDate = raw.hireDate?.trim();
    const employmentStatus = raw.employmentStatus?.trim().toUpperCase();
    const noKk = raw.noKk?.trim();
    const educationLevelLabel = raw.educationLevelLabel?.trim();
    const ptkpStatusCode = raw.ptkpStatusCode?.trim();

    const reasons: string[] = [];
    if (!employeeNumber) reasons.push("Nomor karyawan (employeeNumber) wajib diisi");
    else if (seenInFile.has(employeeNumber)) reasons.push(`Nomor karyawan ${employeeNumber} duplikat dalam berkas`);
    if (!fullLegalName) reasons.push("Nama lengkap (fullLegalName) wajib diisi");
    if (!hireDate || Number.isNaN(Date.parse(hireDate))) {
      reasons.push("Tanggal bergabung (hireDate) wajib diisi dengan format tanggal yang valid");
    }
    if (!employmentStatus || !VALID_EMPLOYMENT_STATUSES.includes(employmentStatus)) {
      reasons.push(`Status kepegawaian (employmentStatus) harus salah satu dari: ${VALID_EMPLOYMENT_STATUSES.join(", ")}`);
    }
    if (gender && !VALID_GENDERS.includes(gender)) {
      reasons.push(`Jenis kelamin (gender) harus salah satu dari: ${VALID_GENDERS.join(", ")}`);
    }
    if (noKk) {
      const noKkError = validateNoKk(noKk);
      if (noKkError) reasons.push(noKkError);
    }
    if (educationLevelLabel && !educationByLabel.has(educationLevelLabel)) {
      reasons.push(`Pendidikan Terakhir (educationLevelLabel) "${educationLevelLabel}" tidak ditemukan`);
    }
    if (ptkpStatusCode && !validPtkpCodes.has(ptkpStatusCode)) {
      reasons.push(`PTKP Pajak (ptkpStatusCode) "${ptkpStatusCode}" tidak ditemukan`);
    }

    if (employeeNumber) seenInFile.add(employeeNumber);
    const existingId = employeeNumber ? employeeByNumber.get(employeeNumber) : undefined;

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
  const employeeNumber = raw.employeeNumber.trim();
  const genderRaw = raw.gender?.trim().toUpperCase();
  const educationLevelLabel = raw.educationLevelLabel?.trim();
  const educationLevel = educationLevelLabel
    ? await prisma.educationLevel.findUnique({ where: { label: educationLevelLabel } })
    : null;
  const ptkpStatusCode = raw.ptkpStatusCode?.trim() || null;

  const data = {
    fullLegalName: raw.fullLegalName.trim(),
    gender: genderRaw ? (genderRaw as Gender) : null,
    workEmail: raw.workEmail?.trim() || null,
    mobileNumber: raw.mobileNumber?.trim() || null,
    hireDate: new Date(raw.hireDate.trim()),
    employmentStatus: raw.employmentStatus.trim().toUpperCase() as EmploymentStatus,
    noKk: raw.noKk?.trim() || null,
    namaIbuKandung: raw.namaIbuKandung?.trim() || null,
    educationLevelId: educationLevel?.id ?? null,
    ptkpStatusCode,
  };

  const existing = await prisma.employee.findUnique({ where: { employeeNumber } });
  if (existing) {
    await prisma.employee.update({ where: { id: existing.id }, data });
    return { id: existing.id, action: "UPDATE" };
  }

  const created = await prisma.employee.create({ data: { employeeNumber, ...data } });
  return { id: created.id, action: "CREATE" };
}

// Sensitive dataset (CTL-13: "sensitive exports require explicit permission
// and audit logging") — reuses the exact same field-level projection as the
// UI (projectEmployee), so a Training/GA Admin export is redacted the same
// way their screen view is; only HR Admin gets every column.
export async function exportData(session: Session): Promise<ExportResult> {
  const employees = await prisma.employee.findMany({
    include: { educationLevel: true },
    orderBy: { employeeNumber: "asc" },
  });
  const rows = employees.map((e) => {
    const projected = projectEmployee(e, session);
    return {
      employeeNumber: projected.employeeNumber ?? "",
      fullLegalName: projected.fullLegalName ?? "",
      gender: projected.gender ?? "",
      workEmail: projected.workEmail ?? "",
      mobileNumber: projected.mobileNumber ?? "",
      hireDate: projected.hireDate ? new Date(projected.hireDate).toISOString().slice(0, 10) : "",
      employmentStatus: projected.employmentStatus ?? "",
      noKk: projected.noKk ?? "",
      namaIbuKandung: projected.namaIbuKandung ?? "",
      // educationLevelId is visible to more roles than the highly-restricted
      // fields above (see permissions.ts) — only show the label if the
      // scalar id itself wasn't stripped for this viewer.
      educationLevelLabel: projected.educationLevelId !== undefined ? e.educationLevel?.label ?? "" : "",
      ptkpStatusCode: projected.ptkpStatusCode ?? "",
    };
  });
  return { headers: templateHeaders, rows };
}

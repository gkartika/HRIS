import { prisma } from "@/lib/db";
import { validateNoKk, validateNationalIdNumber } from "@/lib/validation/employee-fields";
import { projectEmployee } from "@/lib/permissions";
import type { Session } from "next-auth";
import type { Gender, EmploymentStatus } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Karyawan (Employee)";
export const templateHeaders = [
  "employeeNumber",
  "fullLegalName",
  "gender",
  "birthPlace",
  "birthDate",
  "mobileNumber",
  "personalEmail",
  "currentAddressLine",
  "currentAddressRtRw",
  "currentAddressCity",
  "currentAddressDistrict",
  "currentAddressVillage",
  "currentAddressPostalCode",
  "idCardAddressSameAsCurrent",
  "idCardAddressLine",
  "idCardAddressRtRw",
  "idCardAddressCity",
  "idCardAddressDistrict",
  "idCardAddressVillage",
  "idCardAddressPostalCode",
  "hireDate",
  "employmentStatus",
  "activeFlag",
  "nationalIdNumber",
  "noKk",
  "namaIbuKandung",
  "bankAccountName",
  "bankAccountNumber",
  "bpjsEmploymentNumber",
  "bpjsHealthNumber",
  "educationLevelLabel",
  "ptkpStatusCode",
];
export const templateExampleRow = {
  employeeNumber: "CBP-0099",
  fullLegalName: "Nama Contoh",
  gender: "MALE",
  birthPlace: "Jakarta",
  birthDate: "1995-05-17",
  mobileNumber: "0812-0000-0000",
  personalEmail: "",
  currentAddressLine: "Jl. Kenanga No. 12",
  currentAddressRtRw: "003/005",
  currentAddressCity: "Kota Bekasi",
  currentAddressDistrict: "Bekasi Timur",
  currentAddressVillage: "Margahayu",
  currentAddressPostalCode: "17113",
  idCardAddressSameAsCurrent: "Ya",
  idCardAddressLine: "",
  idCardAddressRtRw: "",
  idCardAddressCity: "",
  idCardAddressDistrict: "",
  idCardAddressVillage: "",
  idCardAddressPostalCode: "",
  hireDate: "2026-01-01",
  employmentStatus: "PKWTT",
  activeFlag: "Ya",
  nationalIdNumber: "",
  noKk: "",
  namaIbuKandung: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bpjsEmploymentNumber: "",
  bpjsHealthNumber: "",
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
    const birthDate = raw.birthDate?.trim();
    const hireDate = raw.hireDate?.trim();
    const employmentStatus = raw.employmentStatus?.trim().toUpperCase();
    const activeFlag = raw.activeFlag?.trim().toUpperCase();
    const idCardAddressSameAsCurrent = raw.idCardAddressSameAsCurrent?.trim().toUpperCase();
    const nationalIdNumber = raw.nationalIdNumber?.trim();
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
    if (birthDate && Number.isNaN(Date.parse(birthDate))) {
      reasons.push("Tanggal lahir (birthDate) harus format tanggal yang valid");
    }
    if (activeFlag && !["YA", "TIDAK", "TRUE", "FALSE"].includes(activeFlag)) {
      reasons.push('Status Aktif (activeFlag) harus "Ya" atau "Tidak"');
    }
    if (
      idCardAddressSameAsCurrent &&
      !["YA", "TIDAK", "TRUE", "FALSE"].includes(idCardAddressSameAsCurrent)
    ) {
      reasons.push('Alamat KTP sama dengan domisili (idCardAddressSameAsCurrent) harus "Ya" atau "Tidak"');
    }
    if (nationalIdNumber) {
      const nationalIdError = validateNationalIdNumber(nationalIdNumber);
      if (nationalIdError) reasons.push(nationalIdError);
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
  const activeFlagRaw = raw.activeFlag?.trim().toUpperCase();
  const idCardSameRaw = raw.idCardAddressSameAsCurrent?.trim().toUpperCase();
  const birthDate = raw.birthDate?.trim();

  const data = {
    fullLegalName: raw.fullLegalName.trim(),
    hireDate: new Date(raw.hireDate.trim()),
    employmentStatus: raw.employmentStatus.trim().toUpperCase() as EmploymentStatus,
    // Blank leaves each optional field unchanged on UPDATE (matching the
    // org-units/jobs/positions importers) instead of nulling out real data
    // (e.g. personalEmail/currentAddressLine/nationalIdNumber already entered
    // via the edit form) just because a re-exported CSV left a cell blank.
    // A brand-new employee still gets null/the schema default on CREATE.
    ...(genderRaw ? { gender: genderRaw as Gender } : {}),
    ...(raw.birthPlace?.trim() ? { birthPlace: raw.birthPlace.trim() } : {}),
    ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
    ...(raw.mobileNumber?.trim() ? { mobileNumber: raw.mobileNumber.trim() } : {}),
    ...(raw.personalEmail?.trim() ? { personalEmail: raw.personalEmail.trim() } : {}),
    ...(raw.currentAddressLine?.trim() ? { currentAddressLine: raw.currentAddressLine.trim() } : {}),
    ...(raw.currentAddressRtRw?.trim() ? { currentAddressRtRw: raw.currentAddressRtRw.trim() } : {}),
    ...(raw.currentAddressCity?.trim() ? { currentAddressCity: raw.currentAddressCity.trim() } : {}),
    ...(raw.currentAddressDistrict?.trim()
      ? { currentAddressDistrict: raw.currentAddressDistrict.trim() }
      : {}),
    ...(raw.currentAddressVillage?.trim()
      ? { currentAddressVillage: raw.currentAddressVillage.trim() }
      : {}),
    ...(raw.currentAddressPostalCode?.trim()
      ? { currentAddressPostalCode: raw.currentAddressPostalCode.trim() }
      : {}),
    ...(idCardSameRaw ? { idCardAddressSameAsCurrent: ["YA", "TRUE"].includes(idCardSameRaw) } : {}),
    ...(raw.idCardAddressLine?.trim() ? { idCardAddressLine: raw.idCardAddressLine.trim() } : {}),
    ...(raw.idCardAddressRtRw?.trim() ? { idCardAddressRtRw: raw.idCardAddressRtRw.trim() } : {}),
    ...(raw.idCardAddressCity?.trim() ? { idCardAddressCity: raw.idCardAddressCity.trim() } : {}),
    ...(raw.idCardAddressDistrict?.trim()
      ? { idCardAddressDistrict: raw.idCardAddressDistrict.trim() }
      : {}),
    ...(raw.idCardAddressVillage?.trim()
      ? { idCardAddressVillage: raw.idCardAddressVillage.trim() }
      : {}),
    ...(raw.idCardAddressPostalCode?.trim()
      ? { idCardAddressPostalCode: raw.idCardAddressPostalCode.trim() }
      : {}),
    ...(activeFlagRaw ? { activeFlag: ["YA", "TRUE"].includes(activeFlagRaw) } : {}),
    ...(raw.nationalIdNumber?.trim() ? { nationalIdNumber: raw.nationalIdNumber.trim() } : {}),
    ...(raw.noKk?.trim() ? { noKk: raw.noKk.trim() } : {}),
    ...(raw.namaIbuKandung?.trim() ? { namaIbuKandung: raw.namaIbuKandung.trim() } : {}),
    ...(raw.bankAccountName?.trim() ? { bankAccountName: raw.bankAccountName.trim() } : {}),
    ...(raw.bankAccountNumber?.trim() ? { bankAccountNumber: raw.bankAccountNumber.trim() } : {}),
    ...(raw.bpjsEmploymentNumber?.trim() ? { bpjsEmploymentNumber: raw.bpjsEmploymentNumber.trim() } : {}),
    ...(raw.bpjsHealthNumber?.trim() ? { bpjsHealthNumber: raw.bpjsHealthNumber.trim() } : {}),
    ...(educationLevelLabel ? { educationLevelId: educationLevel?.id ?? null } : {}),
    ...(raw.ptkpStatusCode?.trim() ? { ptkpStatusCode: raw.ptkpStatusCode.trim() } : {}),
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
      birthPlace: projected.birthPlace ?? "",
      birthDate: projected.birthDate ? new Date(projected.birthDate).toISOString().slice(0, 10) : "",
      mobileNumber: projected.mobileNumber ?? "",
      personalEmail: projected.personalEmail ?? "",
      currentAddressLine: projected.currentAddressLine ?? "",
      currentAddressRtRw: projected.currentAddressRtRw ?? "",
      currentAddressCity: projected.currentAddressCity ?? "",
      currentAddressDistrict: projected.currentAddressDistrict ?? "",
      currentAddressVillage: projected.currentAddressVillage ?? "",
      currentAddressPostalCode: projected.currentAddressPostalCode ?? "",
      idCardAddressSameAsCurrent:
        projected.idCardAddressSameAsCurrent === undefined
          ? ""
          : projected.idCardAddressSameAsCurrent
            ? "Ya"
            : "Tidak",
      idCardAddressLine: projected.idCardAddressLine ?? "",
      idCardAddressRtRw: projected.idCardAddressRtRw ?? "",
      idCardAddressCity: projected.idCardAddressCity ?? "",
      idCardAddressDistrict: projected.idCardAddressDistrict ?? "",
      idCardAddressVillage: projected.idCardAddressVillage ?? "",
      idCardAddressPostalCode: projected.idCardAddressPostalCode ?? "",
      hireDate: projected.hireDate ? new Date(projected.hireDate).toISOString().slice(0, 10) : "",
      employmentStatus: projected.employmentStatus ?? "",
      activeFlag: projected.activeFlag ? "Ya" : "Tidak",
      nationalIdNumber: projected.nationalIdNumber ?? "",
      noKk: projected.noKk ?? "",
      namaIbuKandung: projected.namaIbuKandung ?? "",
      bankAccountName: projected.bankAccountName ?? "",
      bankAccountNumber: projected.bankAccountNumber ?? "",
      bpjsEmploymentNumber: projected.bpjsEmploymentNumber ?? "",
      bpjsHealthNumber: projected.bpjsHealthNumber ?? "",
      // educationLevelId is visible to more roles than the highly-restricted
      // fields above (see permissions.ts) — only show the label if the
      // scalar id itself wasn't stripped for this viewer.
      educationLevelLabel: projected.educationLevelId !== undefined ? e.educationLevel?.label ?? "" : "",
      ptkpStatusCode: projected.ptkpStatusCode ?? "",
    };
  });
  return { headers: templateHeaders, rows };
}

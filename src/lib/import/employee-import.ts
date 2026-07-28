import Papa from "papaparse";

export interface EmployeeImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  isValid: boolean;
  rejectionReason: string | null;
}

const VALID_GENDERS = ["MALE", "FEMALE"];
const VALID_EMPLOYMENT_STATUSES = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"];

// CTL-04/CTL-05: dry-run validation before anything touches the Employee table.
// Duplicate check covers both "already in the database" and "duplicated within
// this same file" so a bad file can't create two rows for the same employeeNumber.
export function parseAndValidateEmployeeCsv(
  csvText: string,
  existingEmployeeNumbers: Set<string>
): EmployeeImportRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const seenInFile = new Set<string>();
  const rows: EmployeeImportRow[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-based numbering
    const employeeNumber = raw.employeeNumber?.trim();
    const fullLegalName = raw.fullLegalName?.trim();
    const gender = raw.gender?.trim().toUpperCase();
    const hireDate = raw.hireDate?.trim();
    const employmentStatus = raw.employmentStatus?.trim().toUpperCase();

    const reasons: string[] = [];

    if (!employeeNumber) {
      reasons.push("Nomor karyawan (employeeNumber) wajib diisi");
    } else if (existingEmployeeNumbers.has(employeeNumber) || seenInFile.has(employeeNumber)) {
      reasons.push(`Nomor karyawan ${employeeNumber} sudah digunakan (duplikat)`);
    }

    if (!fullLegalName) {
      reasons.push("Nama lengkap (fullLegalName) wajib diisi");
    }

    if (!hireDate || Number.isNaN(Date.parse(hireDate))) {
      reasons.push("Tanggal bergabung (hireDate) wajib diisi dengan format tanggal yang valid");
    }

    if (!employmentStatus || !VALID_EMPLOYMENT_STATUSES.includes(employmentStatus)) {
      reasons.push(
        `Status kepegawaian (employmentStatus) harus salah satu dari: ${VALID_EMPLOYMENT_STATUSES.join(", ")}`
      );
    }

    if (gender && !VALID_GENDERS.includes(gender)) {
      reasons.push(`Jenis kelamin (gender) harus salah satu dari: ${VALID_GENDERS.join(", ")}`);
    }

    if (employeeNumber) seenInFile.add(employeeNumber);

    rows.push({
      rowNumber,
      raw,
      isValid: reasons.length === 0,
      rejectionReason: reasons.length > 0 ? reasons.join("; ") : null,
    });
  });

  return rows;
}

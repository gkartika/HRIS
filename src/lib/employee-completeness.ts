// DM-17/DM-18/DM-19/DM-20: existing records created before these fields
// existed must not be destroyed or blocked, but should be visibly flagged
// until someone fills them in. Deliberately not a stored DB column (would go
// stale) — always computed fresh from the current field values.
export interface EmployeeCompletenessInput {
  noKk: string | null;
  namaIbuKandung: string | null;
  educationLevelId: string | null;
  ptkpStatusCode: string | null;
  ktpFileId: string | null;
  kkFileId: string | null;
}

export function isEmployeeProfileIncomplete(employee: EmployeeCompletenessInput): boolean {
  return (
    !employee.noKk ||
    !employee.namaIbuKandung ||
    !employee.educationLevelId ||
    !employee.ptkpStatusCode ||
    !employee.ktpFileId ||
    !employee.kkFileId
  );
}

export function missingFieldLabels(employee: EmployeeCompletenessInput): string[] {
  const missing: string[] = [];
  if (!employee.noKk) missing.push("No. KK");
  if (!employee.namaIbuKandung) missing.push("Nama Ibu Kandung");
  if (!employee.educationLevelId) missing.push("Pendidikan Terakhir");
  if (!employee.ptkpStatusCode) missing.push("PTKP Pajak");
  if (!employee.ktpFileId) missing.push("File KTP");
  if (!employee.kkFileId) missing.push("File KK");
  return missing;
}

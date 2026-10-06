// Nomor Karyawan is assigned by the system: CBP-0001, CBP-0002 ... counting up
// by one. Pure helpers (no Prisma) so the format is unit-testable; allocation
// lives in employee-number-allocate.ts.
export const EMPLOYEE_NUMBER_PREFIX = "CBP-";
export const EMPLOYEE_NUMBER_SEQUENCE_KEY = "EMP-CBP";

export function formatEmployeeNumber(sequence: number): string {
  return `${EMPLOYEE_NUMBER_PREFIX}${String(sequence).padStart(4, "0")}`;
}

// 4 for "CBP-0004"; null for anything that is not in the system format
// (an old or imported number like "0027" or "EMP-9" does not count).
export function parseEmployeeNumber(value: string): number | null {
  const match = /^CBP-(\d+)$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

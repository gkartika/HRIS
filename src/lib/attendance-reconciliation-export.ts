import type { GridEmployeeRow, GridDayCell } from "@/lib/attendance-reconciliation-queue";

// Excel export for Rekonsiliasi Grid (Opsi B) — per direct request. Pure
// row-building (no xlsx/Prisma import here, same pattern as
// evaluation.ts/competency.ts) so the cell-format rules are unit-testable;
// the API route hands these rows straight to the `xlsx` package.

const SHIFT_DIGIT: Record<string, string> = { SHIFT_1: "1", SHIFT_2: "2", SHIFT_3: "3", NON_SHIFT: "L" };

// Per direct request: "CT1" (Cuti, Shift 1), "SD2" (SDSD, Shift 2), etc. —
// the absence code as-is (CUTI/IZIN were renamed to CT/I directly in the
// database for this) plus a digit for the shift the entry carried, or "L"
// for Libur (never combined into the code itself, e.g. never
// "CTL" — a Libur day is just "L", full stop, per direct correction).
// A day with no absence code shows the shift alone (digit or "L") — a
// "Masuk" override reuses this exact same branch, no separate "H" code:
// per direct correction, Masuk isn't its own category, it's just confirmed
// presence, same as a real punch. An explicit shiftType with no absence
// code (e.g. a holiday-calendar bulk fill, or any other shift-only HR
// override) is also resolved this way, even with no punch at all — HR (or
// the holiday calendar) already made the call for that day. "?" is a
// genuinely unresolved day: no punch, no override, no explicit shift.
export function formatDayCode(cell: GridDayCell): string {
  const effectiveShift = cell.shiftType ?? cell.assignedShiftType;
  const digit = SHIFT_DIGIT[effectiveShift] ?? "";
  if (cell.absenceTypeCode) return digit === "L" ? "L" : `${cell.absenceTypeCode}${digit}`;
  if (cell.presentOverride || cell.shiftType || (cell.hasCheckIn && cell.hasCheckOut)) return digit;
  return "?";
}

// Decimal hours (not "8j 30m") since payroll needs to sum these directly in
// Excel — 465 minutes -> 7.75, not a formatted string.
export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function buildReconciliationExportSheet(rows: GridEmployeeRow[]): (string | number)[][] {
  const dayCount = rows[0]?.days.length ?? 0;
  const dayHeaders: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = rows[0].days[i].date;
    const label = `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    dayHeaders.push(`Kode ${label}`, `Jam ${label}`);
  }

  const header = ["No", "NIP", "Nama", "Departemen", "Poin", "Jam Kerja Gaji", "Jam Kerja Aktual", ...dayHeaders];

  const body = rows.map((row, index) => {
    const dayCells: (string | number)[] = [];
    for (const day of row.days) {
      dayCells.push(formatDayCode(day), minutesToDecimalHours(day.minutes));
    }
    return [
      index + 1,
      row.employeeNumber,
      row.employeeName,
      row.departmentName,
      row.points,
      minutesToDecimalHours(row.totalMinutes),
      minutesToDecimalHours(row.totalActualMinutes),
      ...dayCells,
    ];
  });

  return [header, ...body];
}

// Filters for the Rekonsiliasi grid (and its Excel): which absence types and
// which shift an employee must have on the days that are shown. Pure logic, no
// Prisma/Next imports, so it is unit testable.
import type { GridDayCell, GridEmployeeRow } from "@/lib/attendance-reconciliation-queue";
import { formatDayCode } from "@/lib/attendance-reconciliation-export";

// Filter keys that are not absence codes.
export const TYPE_PRESENT = "HADIR";
export const TYPE_UNRESOLVED = "?";
export const TYPE_DAY_OFF = "L";

export const SHIFT_FILTER_VALUES = ["SHIFT_1", "SHIFT_2", "SHIFT_3"] as const;

// What kind of day a grid cell is: present, unresolved, a day off, or its absence code.
export function dayTypeKey(cell: GridDayCell): string {
  const code = formatDayCode(cell);
  if (code === "?") return TYPE_UNRESOLVED;
  if (code === "L") return TYPE_DAY_OFF;
  if (/^\d$/.test(code)) return TYPE_PRESENT;
  return cell.absenceTypeCode ?? code;
}

export function effectiveShift(cell: GridDayCell): string {
  return cell.shiftType ?? cell.assignedShiftType;
}

export interface GridFilter {
  /** Absence types (codes, "HADIR", "?", "L"); empty = every type. */
  types: string[];
  /** One of SHIFT_FILTER_VALUES, or null for every shift. */
  shift: string | null;
  /** Only the days inside the shown date range count. */
  inRange: (date: Date) => boolean;
}

// An employee stays when, on the shown days, they had one of the chosen types
// AND were on the chosen shift (on any of the shown days, since the shift can
// change from week to week). Both conditions are optional.
export function filterGridRows(rows: GridEmployeeRow[], filter: GridFilter): GridEmployeeRow[] {
  if (filter.types.length === 0 && !filter.shift) return rows;
  return rows.filter((row) => {
    const days = row.days.filter((d) => filter.inRange(d.date));
    const typeOk = filter.types.length === 0 || days.some((d) => filter.types.includes(dayTypeKey(d)));
    const shiftOk = !filter.shift || days.some((d) => effectiveShift(d) === filter.shift);
    return typeOk && shiftOk;
  });
}

// "types=SH&types=AL" arrives as a string or an array; keep only values that
// can be a type (letters, digits, "?") and drop duplicates.
export function parseTypesParam(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(list.flatMap((v) => v.split(",")).map((v) => v.trim()).filter((v) => /^[A-Za-z0-9?]{1,12}$/.test(v)))];
}

export function parseShiftParam(raw: string | undefined): string | null {
  return (SHIFT_FILTER_VALUES as readonly string[]).includes(raw ?? "") ? (raw as string) : null;
}

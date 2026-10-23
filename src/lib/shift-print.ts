// Wording of the printed Jadwal Shift sheet. Pure, so it can be tested: the screen decides which rows are
// shown, this only words the header (the dates and what was filtered) and each person's shift.
import { MONTH_LABELS_ID, DAY_MS } from "@/lib/company-time";

export type PrintFilter = "all" | "default" | "SHIFT_2" | "SHIFT_3" | "NON_SHIFT";

const SHIFT_PRINT_LABEL = { SHIFT_2: "Shift 2", SHIFT_3: "Shift 3", NON_SHIFT: "Libur" } as const;

/** Someone with no stored change is on the default shift, which is Shift 1. */
export function shiftPrintLabel(shift: keyof typeof SHIFT_PRINT_LABEL | null): string {
  return shift ? SHIFT_PRINT_LABEL[shift] : "Shift 1";
}

const dateText = (d: Date) => `${d.getUTCDate()} ${MONTH_LABELS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** "Minggu 18 Okt 2026 – Sabtu 24 Okt 2026": the company week runs Sunday to Saturday. */
export function weekPrintRange(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return `Minggu ${dateText(start)} – Sabtu ${dateText(end)}`;
}

/** What the sheet was limited to, e.g. "Shift 2 · Semua departemen". */
export function printFilterText(input: { filter: PrintFilter; departmentName: string | null; groupName: string | null; search: string }): string {
  const shift = input.filter === "all" ? "Semua shift" : input.filter === "default" ? "Shift 1 (belum diatur)" : SHIFT_PRINT_LABEL[input.filter];
  const parts = [shift, input.departmentName ? `Departemen: ${input.departmentName}` : "Semua departemen"];
  if (input.groupName) parts.push(`Grup: ${input.groupName}`);
  const search = input.search.trim();
  if (search) parts.push(`Pencarian "${search}"`);
  return parts.join(" · ");
}

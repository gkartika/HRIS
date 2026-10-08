import { companyDateParts, MONTH_LABELS_ID, DAY_MS } from "@/lib/company-time";
// Rekonsiliasi Absensi cutoff period — per direct request, the company's
// payroll cutoff runs 21st through the 20th of the next month (both
// inclusive), the same convention the old spreadsheet tracker used. Pure/
// dependency-free like evaluation.ts/competency.ts — unit testable, no
// Prisma import.
//
// `start`/`end` are UTC-midnight "date-only" values, same convention as
// DailyAttendanceRecord.attendanceDate/AbsenceRequest.startDate (see
// attendance-reconciliation.ts's startOfDay) — required so period
// boundaries compare correctly against those columns regardless of the
// server process's own timezone. `resolveCutoffPeriod`'s `referenceDate`
// is the one exception: it's a real instant (usually "now"), read with
// LOCAL calendar getters (the calendar day a person is actually in) before
// being re-anchored to UTC midnight — same two-step startOfDay does.

export interface CutoffPeriod {
  /** 21st of the start month, UTC midnight, inclusive. */
  start: Date;
  /** 20th of the end month, UTC midnight, inclusive. */
  end: Date;
  label: string;
}

// Kept as a re-export: older code imports it from here.
export { MONTH_LABELS_ID };

function formatPeriodLabel(start: Date, end: Date): string {
  const startLabel = `${start.getUTCDate()} ${MONTH_LABELS_ID[start.getUTCMonth()]}`;
  const endLabel = `${end.getUTCDate()} ${MONTH_LABELS_ID[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  return `${startLabel} – ${endLabel}`;
}

// The period containing `referenceDate` — day 1-20 falls in the period that
// started the 21st of the PREVIOUS month; day 21-31 falls in the period
// starting the 21st of THIS month.
export function resolveCutoffPeriod(referenceDate: Date): CutoffPeriod {
  const { year, month, day } = companyDateParts(referenceDate);
  // month is 1-based here; the period starts on the 21st of this month (day >= 21) or of the previous one.
  const start = new Date(Date.UTC(year, day >= 21 ? month - 1 : month - 2, 21));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 20));
  return { start, end, label: formatPeriodLabel(start, end) };
}

export function previousCutoffPeriod(period: CutoffPeriod): CutoffPeriod {
  const dayBeforeStart = new Date(period.start.getTime() - DAY_MS);
  return resolveCutoffPeriod(dayBeforeStart);
}

export function nextCutoffPeriod(period: CutoffPeriod): CutoffPeriod {
  const dayAfterEnd = new Date(period.end.getTime() + DAY_MS);
  return resolveCutoffPeriod(dayAfterEnd);
}

// ISO-ish "yyyy-mm-dd" round trip for the period picker's query params —
// reads/writes UTC components since every Date this touches is already a
// UTC-midnight date-only value.
export function formatCutoffParam(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseCutoffParam(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

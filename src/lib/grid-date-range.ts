// Date filter for the Rekonsiliasi Grid Lengkap. The grid is one payroll
// cutoff period wide (about 30 days x 2 columns), so HR narrows it to the
// days they are looking at. Only the visible day columns change: Poin and
// Jam Kerja are always the whole period, and the Excel export is always the
// whole period. Pure, UTC-midnight date-only values like absence-cutoff.ts.
import { MONTH_LABELS_ID, DAY_MS } from "@/lib/company-time";
import { parseCutoffParam } from "@/lib/absence-cutoff";


export interface PeriodBounds {
  start: Date;
  end: Date;
}

export interface VisibleRange {
  from: Date;
  to: Date;
  isFull: boolean;
  dayCount: number;
}

export const RANGE_ERROR = "Tanggal sampai harus sama atau setelah tanggal dari.";

function clamp(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function dayCountInclusive(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

// from/to come from the query string. Missing or malformed -> that end of the
// period. Outside the period -> clamped to it. from after to -> the whole
// period again plus an error to show.
export function resolveVisibleRange(
  period: PeriodBounds,
  fromRaw: string | undefined,
  toRaw: string | undefined
): { range: VisibleRange; error: string | null } {
  const fromParsed = parseCutoffParam(fromRaw);
  const toParsed = parseCutoffParam(toRaw);
  const from = fromParsed ? clamp(fromParsed, period.start, period.end) : period.start;
  const to = toParsed ? clamp(toParsed, period.start, period.end) : period.end;
  if (from > to) {
    return { range: fullRange(period), error: RANGE_ERROR };
  }
  return { range: buildRange(period, from, to), error: null };
}

function fullRange(period: PeriodBounds): VisibleRange {
  return buildRange(period, period.start, period.end);
}

function buildRange(period: PeriodBounds, from: Date, to: Date): VisibleRange {
  return {
    from,
    to,
    isFull: from.getTime() === period.start.getTime() && to.getTime() === period.end.getTime(),
    dayCount: dayCountInclusive(from, to),
  };
}

export interface RangeShortcut {
  key: "all" | "today" | "last7" | "week";
  label: string;
  from: Date;
  to: Date;
}

// One-click ranges. "today" is only offered when today is inside the period
// being viewed; for a past period "7 hari terakhir" means the last 7 days of
// that period, and a future period offers only the whole period.
export function rangeShortcuts(period: PeriodBounds, today: Date): RangeShortcut[] {
  const shortcuts: RangeShortcut[] = [{ key: "all", label: "Seluruh periode", from: period.start, to: period.end }];
  if (today < period.start) return shortcuts;

  if (today <= period.end) {
    shortcuts.push({ key: "today", label: "Hari ini", from: today, to: today });
  }

  const lastDay = today > period.end ? period.end : today;
  const last7From = clamp(new Date(lastDay.getTime() - 6 * DAY_MS), period.start, period.end);
  shortcuts.push({ key: "last7", label: "7 hari terakhir", from: last7From, to: lastDay });

  if (today <= period.end) {
    // Monday to Sunday of today's week, cut to the period.
    const weekday = today.getUTCDay(); // 0 = Sunday
    const mondayOffset = weekday === 0 ? 6 : weekday - 1;
    const monday = new Date(today.getTime() - mondayOffset * DAY_MS);
    const sunday = new Date(monday.getTime() + 6 * DAY_MS);
    shortcuts.push({
      key: "week",
      label: "Minggu ini",
      from: clamp(monday, period.start, period.end),
      to: clamp(sunday, period.start, period.end),
    });
  }
  return shortcuts;
}

export function sameRange(a: { from: Date; to: Date }, b: { from: Date; to: Date }): boolean {
  return a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime();
}

// "5 Okt" / "5 – 11 Okt" / "28 Sep – 3 Okt" for the "Menampilkan …" line.
function dayMonth(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_LABELS_ID[date.getUTCMonth()]}`;
}
export function formatRangeLabel(from: Date, to: Date): string {
  if (from.getTime() === to.getTime()) return dayMonth(from);
  if (from.getUTCMonth() === to.getUTCMonth()) return `${from.getUTCDate()} – ${dayMonth(to)}`;
  return `${dayMonth(from)} – ${dayMonth(to)}`;
}

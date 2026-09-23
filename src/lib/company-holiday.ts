// Pure business logic for the bulk holiday calendar — per direct request,
// HR-Admin pastes a whole year of dates in one textarea instead of adding
// them one at a time. No Prisma/Next imports — unit testable with plain
// values, same pattern as offboarding.ts/absence-cutoff.ts.

export interface ParsedHolidayLine {
  lineNumber: number;
  raw: string;
  date: Date | null;
  label: string;
}

export interface ParseHolidayLinesResult {
  valid: ParsedHolidayLine[];
  errors: string[];
}

const LINE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/;

// One holiday per line: "YYYY-MM-DD Label text" — e.g. "2026-01-01 Tahun
// Baru Masehi". Blank lines are ignored. `date` is a UTC-midnight
// "date-only" value, same convention as DailyAttendanceRecord.attendanceDate
// (see attendance-reconciliation.ts's startOfDay) — required so it compares
// correctly against that column regardless of the server process's own timezone.
// All-or-nothing: any malformed line fails the whole batch, so HR sees
// exactly which line(s) to fix rather than a partially-applied list.
export function parseHolidayLines(text: string): ParseHolidayLinesResult {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const valid: ParsedHolidayLine[] = [];
  const errors: string[] = [];

  lines.forEach((raw, i) => {
    const lineNumber = i + 1;
    const match = LINE_PATTERN.exec(raw);
    if (!match) {
      errors.push(`Baris ${lineNumber}: format harus "YYYY-MM-DD Label" (mis. "2026-01-01 Tahun Baru Masehi")`);
      return;
    }
    const [, y, m, d, label] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(m) - 1) {
      errors.push(`Baris ${lineNumber}: tanggal "${y}-${m}-${d}" tidak valid`);
      return;
    }
    valid.push({ lineNumber, raw, date, label: label.trim() });
  });

  return { valid, errors };
}

// One company timezone for every "today / this year / this week" decision.
// The server runs in UTC while everyone works in WIB (UTC+7), so reading the
// server's local clock (getFullYear()/getDate()/getHours()…) put "today" up to
// 7 hours behind. Everything time-of-day or calendar-day related goes through
// here instead; pure date-only values (stored as UTC midnight, see
// shift-assignment.ts) keep using the getUTC* getters.
export const COMPANY_TIME_ZONE = "Asia/Jakarta";

export interface CompanyDateParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0 = Sunday .. 6 = Saturday
  hour: number;
  minute: number;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: COMPANY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function companyDateParts(date: Date = new Date()): CompanyDateParts {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAYS[parts.weekday],
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function companyYear(date: Date = new Date()): number {
  return companyDateParts(date).year;
}

// The company-local calendar day of `date`, as a UTC-midnight date-only value.
export function companyToday(date: Date = new Date()): Date {
  const { year, month, day } = companyDateParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

// The real instant at which the company-local day of `date` begins (00:00 WIB)
// — for querying timestamps (check-in events) that fall on "today".
export function startOfCompanyDay(date: Date = new Date()): Date {
  const { year, month, day } = companyDateParts(date);
  // Asia/Jakarta has no daylight saving: a fixed +07:00 offset.
  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
}

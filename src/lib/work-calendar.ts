import { companyDateParts } from "@/lib/company-time";
// WF-18: "P1 and P2 each have five working days... using the configured
// company work calendar." No Holiday/WorkingCalendar admin table exists
// anywhere in this app yet (see CTL tab — only EducationLevel/PtkpStatus are
// admin-maintained dropdowns), so this is a simplified Mon-Fri calendar with
// no Indonesian public-holiday awareness. Documented as a known
// simplification in docs/DECISIONS.md — revisit with a real holiday table
// when that becomes a priority.

function isWeekend(date: Date): boolean {
  const day = companyDateParts(date).weekday;
  return day === 0 || day === 6;
}

/**
 * Adds `n` working days (Mon-Fri) to `date`. Does not count `date` itself as
 * day zero unless it's already a working day being advanced from.
 */
export function addWorkingDays(date: Date, n: number): Date {
  const result = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }
  return result;
}

export function isOverdue(dueDate: Date | null, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  return now.getTime() > dueDate.getTime();
}

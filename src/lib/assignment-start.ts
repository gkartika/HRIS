import { companyToday } from "@/lib/company-time";

// Berlaku Sejak (effectiveFrom) of a placement when the import file does not
// give one. Order: the date in the file, else the employee's hire date, else
// today. Every placement therefore has a start date (the "who holds this seat
// now" checks compare against it); HR can correct it later from the employee's
// Penempatan tab. "Today" is never later than the actual moment, otherwise an
// import done between 00:00 and 07:00 WIB would look like it starts in the
// future.
export function resolveAssignmentStart(
  fromFile: string | undefined,
  hireDate: Date | null,
  now: Date = new Date()
): Date {
  const typed = fromFile?.trim();
  if (typed) return new Date(typed);
  if (hireDate && hireDate <= now) return hireDate;
  const today = companyToday(now);
  return today > now ? now : today;
}

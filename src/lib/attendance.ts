// Pure business logic for Phase 2 Extension: Attendance. No Prisma/Next
// imports — unit testable with plain values, same pattern as
// offboarding.ts/contract-renewal.ts/work-calendar.ts.
//
// Per direct user request, there is no per-employee/admin-configurable work
// schedule — every employee shares one fixed company default (checked in/out
// is never gated by it, it only drives the LATE_CHECK_IN exception below).
// Daily exceptions (missing punch, late, outside geofence) are deliberately
// never stored — they're derived live here from the linked events, same
// convention as deriveEmployeeLifecycleStatus.
export const DEFAULT_GRACE_MINUTES = 10;
export const DEFAULT_START_TIME = "07:30";
// End time differs Fri vs Mon-Thu but is purely informational — no exception
// check ever compares against it (only late CHECK_IN and missing punches are
// flagged), so it never needs to be day-aware in the exception logic itself.
export const DEFAULT_END_TIME_MON_THU = "16:30";
export const DEFAULT_END_TIME_FRIDAY = "17:00";
export const DEFAULT_WORK_DAYS_CSV = "1,2,3,4,5"; // Mon-Fri

// Formats a Date's own local calendar date as YYYY-MM-DD. NEVER use
// `date.toISOString().slice(0, 10)` for this — that converts to UTC first,
// which silently shifts the date back a day for any positive UTC offset
// (e.g. WIB, UTC+7): a local midnight Date becomes 17:00 the PREVIOUS day in
// UTC. This bit both the Rekap Absensi date filter (always echoing/exporting
// the day before whatever was actually queried) and the CSV export's
// filename/audit reason.
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export interface AttendanceGeofenceLike {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface AttendanceEventLike {
  eventAt: Date;
  latitude: number | null;
  longitude: number | null;
}

// null = not evaluable (no coordinates captured — e.g. a FINGERPRINT_IMPORT
// event — or no active geofence configured at all) — deliberately distinct
// from false, so callers never mistake "not checked" for "checked and
// failed". true if the event falls within ANY of the given geofences —
// there is no longer a single "the" geofence an event is checked against;
// any active company location counts (Version after UAT, per direct
// request to support multiple base locations).
export function isEventWithinAnyGeofence(
  event: { latitude: number | null; longitude: number | null },
  geofences: AttendanceGeofenceLike[]
): boolean | null {
  if (event.latitude === null || event.longitude === null || geofences.length === 0) return null;
  return geofences.some(
    (g) => haversineDistanceMeters(event.latitude!, event.longitude!, g.latitude, g.longitude) <= g.radiusMeters
  );
}

function isoWeekday(date: Date): number {
  const day = date.getDay(); // 0=Sunday..6=Saturday
  return day === 0 ? 7 : day;
}

export function isWorkingDay(date: Date): boolean {
  return isoWeekday(date) >= 1 && isoWeekday(date) <= 5;
}

// Display-only — Friday's later closing time, never enforced by any
// exception check.
export function defaultEndTimeLabel(date: Date): string {
  return isoWeekday(date) === 5 ? DEFAULT_END_TIME_FRIDAY : DEFAULT_END_TIME_MON_THU;
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isLateCheckIn(checkInAt: Date): boolean {
  const checkInMinutes = checkInAt.getHours() * 60 + checkInAt.getMinutes();
  return checkInMinutes > parseTimeToMinutes(DEFAULT_START_TIME) + DEFAULT_GRACE_MINUTES;
}

export type AttendanceException =
  | "MISSING_CHECK_IN"
  | "MISSING_CHECK_OUT"
  | "LATE_CHECK_IN"
  | "OUTSIDE_GEOFENCE_CHECK_IN"
  | "OUTSIDE_GEOFENCE_CHECK_OUT";

export interface AttendanceExceptionInput {
  attendanceDate: Date;
  checkInEvent: AttendanceEventLike | null;
  checkOutEvent: AttendanceEventLike | null;
  activeGeofences: AttendanceGeofenceLike[];
}

export function deriveDailyAttendanceExceptions(input: AttendanceExceptionInput): AttendanceException[] {
  if (!isWorkingDay(input.attendanceDate)) return [];

  const exceptions: AttendanceException[] = [];

  if (!input.checkInEvent) {
    // Per direct user request: check-out is allowed without a prior
    // check-in (never blocked) — but a check-out with no check-in on
    // record reads as "they were here, they just never punched in", which
    // is closer to a late check-in than a genuinely missing one.
    exceptions.push(input.checkOutEvent ? "LATE_CHECK_IN" : "MISSING_CHECK_IN");
  } else {
    if (isLateCheckIn(input.checkInEvent.eventAt)) {
      exceptions.push("LATE_CHECK_IN");
    }
    if (isEventWithinAnyGeofence(input.checkInEvent, input.activeGeofences) === false) {
      exceptions.push("OUTSIDE_GEOFENCE_CHECK_IN");
    }
  }

  if (!input.checkOutEvent) {
    exceptions.push("MISSING_CHECK_OUT");
  } else if (isEventWithinAnyGeofence(input.checkOutEvent, input.activeGeofences) === false) {
    exceptions.push("OUTSIDE_GEOFENCE_CHECK_OUT");
  }

  return exceptions;
}

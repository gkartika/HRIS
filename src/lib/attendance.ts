import { companyDateParts } from "@/lib/company-time";
// Pure business logic for Phase 2 Extension: Attendance. No Prisma/Next
// imports — unit testable with plain values, same pattern as
// offboarding.ts/contract-renewal.ts/work-calendar.ts.
//
// Check-in/out is never blocked by time or place. When a shift starts, and how
// much grace a check-in gets, is set per shift in Pengaturan (ShiftStartConfig);
// it only drives the late check below (isLateForShift).
// End time differs Fri vs Mon-Thu but is purely informational — no exception
// check ever compares against it (only late CHECK_IN and missing punches are
// flagged), so it never needs to be day-aware in the exception logic itself.
export const DEFAULT_END_TIME_MON_THU = "16:30";
export const DEFAULT_END_TIME_FRIDAY = "17:00";

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
  const day = companyDateParts(date).weekday; // 0=Sunday..6=Saturday, in company time
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

export interface ShiftStart {
  /** "HH:MM" company (WIB) time, or null when the shift's start has not been set. */
  startTime: string | null;
  graceMinutes: number;
}

// "07:30" -> 450; anything that is not a valid HH:MM -> null.
export function parseStartMinutes(hhmm: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}

// Late = checked in after the shift's start plus its grace. A shift with no
// start time set is never late.
export function isLateForShift(checkInAt: Date, start: ShiftStart | null | undefined): boolean {
  const startMinutes = parseStartMinutes(start?.startTime);
  if (startMinutes === null) return false;
  const { hour, minute } = companyDateParts(checkInAt);
  return hour * 60 + minute > startMinutes + (start?.graceMinutes ?? 0);
}


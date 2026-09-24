import { companyDateParts } from "@/lib/company-time";
// Pure business logic for Phase 2 Extension: Attendance. No Prisma/Next
// imports — unit testable with plain values, same pattern as
// offboarding.ts/contract-renewal.ts/work-calendar.ts.
//
// Per direct user request, there is no per-employee/admin-configurable work
// schedule — every employee shares one fixed company default (checked in/out
// is never gated by it, it only drives the isLateCheckIn check below).
export const DEFAULT_GRACE_MINUTES = 10;
export const DEFAULT_START_TIME = "07:30";
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

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isLateCheckIn(checkInAt: Date): boolean {
  const { hour, minute } = companyDateParts(checkInAt);
  const checkInMinutes = hour * 60 + minute;
  return checkInMinutes > parseTimeToMinutes(DEFAULT_START_TIME) + DEFAULT_GRACE_MINUTES;
}


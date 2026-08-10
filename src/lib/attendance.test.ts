import { describe, it, expect } from "vitest";
import {
  haversineDistanceMeters,
  isEventWithinGeofence,
  isWorkingDay,
  defaultEndTimeLabel,
  isLateCheckIn,
  deriveDailyAttendanceExceptions,
  DEFAULT_END_TIME_MON_THU,
  DEFAULT_END_TIME_FRIDAY,
} from "./attendance";

describe("haversineDistanceMeters", () => {
  it("is zero for identical coordinates", () => {
    expect(haversineDistanceMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it("returns a positive distance for distinct coordinates", () => {
    // Roughly Jakarta to Bandung — should be on the order of 100km+
    const distance = haversineDistanceMeters(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(distance).toBeGreaterThan(100000);
    expect(distance).toBeLessThan(200000);
  });
});

describe("isEventWithinGeofence", () => {
  const geofence = { latitude: 0, longitude: 0, radiusMeters: 100 };

  it("returns null when no geofence is assigned", () => {
    expect(isEventWithinGeofence({ eventAt: new Date(), latitude: 0, longitude: 0, geofence: null })).toBeNull();
  });

  it("returns null when coordinates are missing (e.g. a Fingerprint import event)", () => {
    expect(isEventWithinGeofence({ eventAt: new Date(), latitude: null, longitude: null, geofence })).toBeNull();
  });

  it("returns true when within radius", () => {
    expect(isEventWithinGeofence({ eventAt: new Date(), latitude: 0.0001, longitude: 0, geofence })).toBe(true);
  });

  it("returns false when outside radius", () => {
    expect(isEventWithinGeofence({ eventAt: new Date(), latitude: 5, longitude: 5, geofence })).toBe(false);
  });
});

describe("isWorkingDay (fixed Mon-Fri default)", () => {
  it("treats Sunday and Saturday as non-working", () => {
    expect(isWorkingDay(new Date("2026-08-09T10:00:00"))).toBe(false); // Sunday
    expect(isWorkingDay(new Date("2026-08-08T10:00:00"))).toBe(false); // Saturday
  });

  it("treats Monday through Friday as working days", () => {
    expect(isWorkingDay(new Date("2026-08-10T10:00:00"))).toBe(true); // Monday
    expect(isWorkingDay(new Date("2026-08-14T10:00:00"))).toBe(true); // Friday
  });
});

describe("defaultEndTimeLabel", () => {
  it("is the Mon-Thu closing time on a Monday", () => {
    expect(defaultEndTimeLabel(new Date("2026-08-10T10:00:00"))).toBe(DEFAULT_END_TIME_MON_THU);
  });

  it("is the later Friday closing time on a Friday", () => {
    expect(defaultEndTimeLabel(new Date("2026-08-14T10:00:00"))).toBe(DEFAULT_END_TIME_FRIDAY);
  });
});

describe("isLateCheckIn (07:30 start, 10 minute grace)", () => {
  it("is not late within the grace window", () => {
    expect(isLateCheckIn(new Date("2026-08-10T07:40:00"))).toBe(false);
  });

  it("is late past the grace window", () => {
    expect(isLateCheckIn(new Date("2026-08-10T07:41:00"))).toBe(true);
  });
});

describe("deriveDailyAttendanceExceptions", () => {
  it("returns no exceptions on a non-working day even with no events", () => {
    const exceptions = deriveDailyAttendanceExceptions({
      attendanceDate: new Date("2026-08-09T00:00:00"), // Sunday
      checkInEvent: null,
      checkOutEvent: null,
    });
    expect(exceptions).toEqual([]);
  });

  it("flags missing check-in and check-out on a working day", () => {
    const exceptions = deriveDailyAttendanceExceptions({
      attendanceDate: new Date("2026-08-10T00:00:00"), // Monday
      checkInEvent: null,
      checkOutEvent: null,
    });
    expect(exceptions).toEqual(["MISSING_CHECK_IN", "MISSING_CHECK_OUT"]);
  });

  it("flags a late, out-of-geofence check-in", () => {
    const geofence = { latitude: 0, longitude: 0, radiusMeters: 100 };
    const exceptions = deriveDailyAttendanceExceptions({
      attendanceDate: new Date("2026-08-10T00:00:00"),
      checkInEvent: { eventAt: new Date("2026-08-10T07:45:00"), latitude: 5, longitude: 5, geofence },
      checkOutEvent: { eventAt: new Date("2026-08-10T16:30:00"), latitude: 0, longitude: 0, geofence },
    });
    expect(exceptions).toEqual(["LATE_CHECK_IN", "OUTSIDE_GEOFENCE_CHECK_IN"]);
  });

  it("has no exceptions for a clean on-time, in-geofence day", () => {
    const geofence = { latitude: 0, longitude: 0, radiusMeters: 100 };
    const exceptions = deriveDailyAttendanceExceptions({
      attendanceDate: new Date("2026-08-10T00:00:00"),
      checkInEvent: { eventAt: new Date("2026-08-10T07:25:00"), latitude: 0, longitude: 0, geofence },
      checkOutEvent: { eventAt: new Date("2026-08-10T16:30:00"), latitude: 0, longitude: 0, geofence },
    });
    expect(exceptions).toEqual([]);
  });
});

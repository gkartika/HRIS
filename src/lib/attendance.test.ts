import { describe, it, expect } from "vitest";
import {
  haversineDistanceMeters,
  isEventWithinAnyGeofence,
  isWorkingDay,
  defaultEndTimeLabel,
  isLateForShift,
  parseStartMinutes,
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

describe("isEventWithinAnyGeofence", () => {
  const geofenceA = { latitude: 0, longitude: 0, radiusMeters: 100 };
  const geofenceB = { latitude: 10, longitude: 10, radiusMeters: 100 };

  it("returns null when no active geofences are configured", () => {
    expect(isEventWithinAnyGeofence({ latitude: 0, longitude: 0 }, [])).toBeNull();
  });

  it("returns null when coordinates are missing (e.g. a Fingerprint import event)", () => {
    expect(isEventWithinAnyGeofence({ latitude: null, longitude: null }, [geofenceA])).toBeNull();
  });

  it("returns true when within radius of the only geofence", () => {
    expect(isEventWithinAnyGeofence({ latitude: 0.0001, longitude: 0 }, [geofenceA])).toBe(true);
  });

  it("returns false when outside every configured geofence", () => {
    expect(isEventWithinAnyGeofence({ latitude: 5, longitude: 5 }, [geofenceA, geofenceB])).toBe(false);
  });

  it("returns true when within radius of any one of several geofences", () => {
    expect(isEventWithinAnyGeofence({ latitude: 10.0001, longitude: 10 }, [geofenceA, geofenceB])).toBe(true);
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

describe("parseStartMinutes", () => {
  it("reads HH:MM as minutes after midnight", () => {
    expect(parseStartMinutes("07:30")).toBe(450);
    expect(parseStartMinutes("7:05")).toBe(425);
    expect(parseStartMinutes("23:59")).toBe(1439);
  });

  it("rejects anything that is not a time", () => {
    expect(parseStartMinutes(null)).toBeNull();
    expect(parseStartMinutes("")).toBeNull();
    expect(parseStartMinutes("24:00")).toBeNull();
    expect(parseStartMinutes("7.30")).toBeNull();
  });
});

describe("isLateForShift", () => {
  const shift1 = { startTime: "07:30", graceMinutes: 10 };
  const shift2 = { startTime: "15:30", graceMinutes: 5 };

  it("is not late up to the end of the grace window", () => {
    expect(isLateForShift(new Date("2026-08-10T07:40:00"), shift1)).toBe(false);
  });

  it("is late one minute past the grace window", () => {
    expect(isLateForShift(new Date("2026-08-10T07:41:00"), shift1)).toBe(true);
  });

  it("follows each shift's own start time", () => {
    expect(isLateForShift(new Date("2026-08-10T15:34:00"), shift2)).toBe(false);
    expect(isLateForShift(new Date("2026-08-10T15:36:00"), shift2)).toBe(true);
    // The same clock time that is late for Shift 1 is early for Shift 2.
    expect(isLateForShift(new Date("2026-08-10T08:00:00"), shift2)).toBe(false);
  });

  it("is never late when the shift has no start time set", () => {
    expect(isLateForShift(new Date("2026-08-10T23:00:00"), { startTime: null, graceMinutes: 10 })).toBe(false);
    expect(isLateForShift(new Date("2026-08-10T23:00:00"), undefined)).toBe(false);
  });
});

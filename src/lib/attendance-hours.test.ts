import { describe, it, expect } from "vitest";
import { formatMinutesAsHours, computeDayMinutes, computeActualDayMinutes } from "./attendance-hours";

const schedule: Record<string, number> = {
  "SHIFT_1:1": 480, // Monday, 8h
  "SHIFT_2:5": 330, // Friday, 5h30
  "SHIFT_2:0": 630, // Sunday, 10h30
};
const scheduleMinutesFor = (shiftType: string, dayOfWeek: number) => schedule[`${shiftType}:${dayOfWeek}`] ?? 0;

describe("formatMinutesAsHours", () => {
  it("formats whole hours without minutes", () => {
    expect(formatMinutesAsHours(480)).toBe("8j");
  });

  it("formats hours with a minutes remainder", () => {
    expect(formatMinutesAsHours(330)).toBe("5j 30m");
  });

  it("floors non-positive input to 0j", () => {
    expect(formatMinutesAsHours(0)).toBe("0j");
    expect(formatMinutesAsHours(-10)).toBe("0j");
  });
});

describe("computeDayMinutes", () => {
  it("a present day (check-in and check-out) credits its shift's scheduled minutes", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 1, hasCheckIn: true, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(480);
  });

  it("a present day prefers an explicit record override over the weekly assignment", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 5, hasCheckIn: true, recordShiftType: "SHIFT_2", assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(330);
  });

  it("an absent day with no classification credits nothing", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(0);
  });

  it("a paid-absence day (e.g. SDSD) credits full scheduled hours, but only with an explicit shift on the entry", () => {
    const withShift = computeDayMinutes(
      { dayOfWeek: 0, hasCheckIn: false, recordShiftType: "SHIFT_2", assignedShiftType: "SHIFT_1", absenceTypeCode: "SDSD", hoursMultiplier: 1, presentOverride: false },
      scheduleMinutesFor
    );
    expect(withShift).toBe(630);

    const withoutShift = computeDayMinutes(
      { dayOfWeek: 0, hasCheckIn: false, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: "SDSD", hoursMultiplier: 1, presentOverride: false },
      scheduleMinutesFor
    );
    expect(withoutShift).toBe(0);
  });

  it("a half-day classification (SH) credits half the scheduled minutes", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: "SHIFT_1", assignedShiftType: "SHIFT_1", absenceTypeCode: "SH", hoursMultiplier: 0.5, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(240);
  });

  it("an unpaid classification (hoursMultiplier 0) credits nothing even with a shift on the entry", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: "SHIFT_1", assignedShiftType: "SHIFT_1", absenceTypeCode: "AL", hoursMultiplier: 0, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(0);
  });

  it("a presentOverride day (forgotten scan, HR marked Masuk) credits full scheduled hours despite no punch", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: "SHIFT_1", assignedShiftType: "SHIFT_2", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: true },
      scheduleMinutesFor
    );
    expect(minutes).toBe(480);
  });

  it("a presentOverride day falls back to the weekly assignment when no shift override was set", () => {
    const minutes = computeDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: true },
      scheduleMinutesFor
    );
    expect(minutes).toBe(480);
  });
});

describe("computeActualDayMinutes", () => {
  it("credits a real present day the same as computeDayMinutes", () => {
    const minutes = computeActualDayMinutes(
      { dayOfWeek: 1, hasCheckIn: true, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(480);
  });

  it("credits a Masuk presentOverride day the same as computeDayMinutes", () => {
    const minutes = computeActualDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: true },
      scheduleMinutesFor
    );
    expect(minutes).toBe(480);
  });

  it("credits nothing for a paid-absence day (e.g. SDSD) — unlike computeDayMinutes, this is never counted as real hours worked", () => {
    const minutes = computeActualDayMinutes(
      { dayOfWeek: 0, hasCheckIn: false, recordShiftType: "SHIFT_2", assignedShiftType: "SHIFT_1", absenceTypeCode: "SDSD", hoursMultiplier: 1, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(0);
  });

  it("credits nothing for an unclassified absent day", () => {
    const minutes = computeActualDayMinutes(
      { dayOfWeek: 1, hasCheckIn: false, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: false },
      scheduleMinutesFor
    );
    expect(minutes).toBe(0);
  });
});

describe("a check-in alone counts the day (no check-out needed)", () => {
  const scheduleMinutesFor = (_shift: string, day: number) => (day === 0 || day === 6 ? 0 : 480);
  const base = { dayOfWeek: 1, hasCheckIn: true, recordShiftType: null, assignedShiftType: "SHIFT_1", absenceTypeCode: null, hoursMultiplier: 0, presentOverride: false };

  it("pays and counts the shift's scheduled minutes, never more", () => {
    expect(computeDayMinutes(base, scheduleMinutesFor)).toBe(480);
    expect(computeActualDayMinutes(base, scheduleMinutesFor)).toBe(480);
  });

  it("counts nothing without a check-in", () => {
    expect(computeDayMinutes({ ...base, hasCheckIn: false }, scheduleMinutesFor)).toBe(0);
  });
});

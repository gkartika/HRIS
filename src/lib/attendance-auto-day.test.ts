import { describe, expect, it } from "vitest";
import { autoReasonLabel, buildAutoDayVerdicts, classifyByLateness, type AutoDayEvent, type AutoDayInput } from "./attendance-auto-day";
import { punchDayKey } from "./punch-days";

describe("classifyByLateness", () => {
  it("is a full day until the check-in is half the schedule late", () => {
    expect(classifyByLateness(0, 480)).toBe("FULL");
    expect(classifyByLateness(239, 480)).toBe("FULL");
  });

  it("is a half day from half the schedule late (4 hours on an 8-hour shift)", () => {
    expect(classifyByLateness(240, 480)).toBe("HALF");
    expect(classifyByLateness(400, 480)).toBe("HALF");
  });

  it("follows the shift's own schedule: 3 hours on a 6-hour shift", () => {
    expect(classifyByLateness(179, 360)).toBe("FULL");
    expect(classifyByLateness(180, 360)).toBe("HALF");
  });

  it("is full when nothing was scheduled", () => {
    expect(classifyByLateness(500, 0)).toBe("FULL");
  });
});

// 2026-10-12 is a Monday. WIB is UTC+7, so 07:50 WIB is 00:50Z.
const at = (hhmmWib: string) => {
  const [h, m] = hhmmWib.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 12, h - 7, m));
};
const DAY = new Date(Date.UTC(2026, 9, 12));

function input(over: Partial<AutoDayInput> & { events: AutoDayEvent[] }): AutoDayInput {
  return {
    decidedDays: [],
    assignedShiftFor: () => "SHIFT_1",
    scheduleMinutesFor: () => 480,
    startFor: (shift) => (shift === "SHIFT_1" ? { startTime: "07:30", graceMinutes: 10 } : undefined),
    holidayTimes: new Set(),
    ...over,
  };
}

const checkIn = (hhmm: string, outside = false): AutoDayEvent => ({ employeeId: "e1", eventType: "CHECK_IN", eventAt: at(hhmm), withinGeofence: outside ? false : true });
const checkOut = (hhmm: string): AutoDayEvent => ({ employeeId: "e1", eventType: "CHECK_OUT", eventAt: at(hhmm), withinGeofence: true });
const key = punchDayKey("e1", DAY);

describe("buildAutoDayVerdicts", () => {
  it("gives no verdict to an on-time check-in inside the location", () => {
    expect(buildAutoDayVerdicts(input({ events: [checkIn("07:35")] })).size).toBe(0);
  });

  it("a check-in within the grace window is not late", () => {
    expect(buildAutoDayVerdicts(input({ events: [checkIn("07:40")] })).size).toBe(0);
  });

  it("a late check-in under 4 hours late stays a full day, decided at check-in with no check-out", () => {
    const v = buildAutoDayVerdicts(input({ events: [checkIn("09:30")] })).get(key);
    expect(v?.kind).toBe("FULL");
    expect(v?.late).toBe(true);
    expect(v?.lateMinutes).toBe(120);
  });

  it("a check-in 4 hours or more after the start is a half day straight away", () => {
    const v = buildAutoDayVerdicts(input({ events: [checkIn("11:30")] })).get(key);
    expect(v?.kind).toBe("HALF");
    expect(v?.lateMinutes).toBe(240);
    expect(v?.halfDayAfterMinutes).toBe(240);
  });

  it("one minute short of 4 hours late is still a full day", () => {
    expect(buildAutoDayVerdicts(input({ events: [checkIn("11:29")] })).get(key)?.kind).toBe("FULL");
  });

  it("the check-out does not change the outcome", () => {
    expect(buildAutoDayVerdicts(input({ events: [checkIn("12:00"), checkOut("12:30")] })).get(key)?.kind).toBe("HALF");
    expect(buildAutoDayVerdicts(input({ events: [checkIn("08:30"), checkOut("12:30")] })).get(key)?.kind).toBe("FULL");
  });

  it("a check-in outside the location is only flagged, the day stays full", () => {
    const v = buildAutoDayVerdicts(input({ events: [checkIn("07:30", true)] })).get(key);
    expect(v?.kind).toBe("FULL");
    expect(v?.outsideLocation).toBe(true);
    expect(v?.late).toBe(false);
  });

  it("late and outside: lateness decides", () => {
    const v = buildAutoDayVerdicts(input({ events: [checkIn("12:00", true)] })).get(key);
    expect(v?.kind).toBe("HALF");
    expect(v?.late).toBe(true);
    expect(v?.outsideLocation).toBe(true);
  });

  it("judges against the shift the person is rostered on, with the half-day limit from that shift's schedule", () => {
    const events = [checkIn("11:30")];
    // Shift 2: no start time set, so never late.
    expect(buildAutoDayVerdicts(input({ events, assignedShiftFor: () => "SHIFT_2" })).size).toBe(0);
    // Shift 2 starting 08:00 with a 6-hour schedule: 3.5 hours late is past the 3-hour half-day limit.
    const v = buildAutoDayVerdicts(
      input({ events, assignedShiftFor: () => "SHIFT_2", scheduleMinutesFor: () => 360, startFor: () => ({ startTime: "08:00", graceMinutes: 5 }) })
    ).get(key);
    expect(v?.kind).toBe("HALF");
    expect(v?.halfDayAfterMinutes).toBe(180);
  });

  it("marks a day somebody already decided, so it is not changed again", () => {
    const events = [checkIn("12:00")];
    expect(buildAutoDayVerdicts(input({ events })).get(key)?.decided).toBe(false);
    for (const decision of [{ absenceTypeCode: "SH" }, { presentOverride: true }, { shiftType: "SHIFT_1" }]) {
      const decidedDays = [{ employeeId: "e1", attendanceDate: DAY, absenceTypeCode: null, presentOverride: false, shiftType: null, ...decision }];
      expect(buildAutoDayVerdicts(input({ events, decidedDays })).get(key)?.decided).toBe(true);
    }
  });

  it("leaves days off and public holidays alone", () => {
    const events = [checkIn("12:00")];
    expect(buildAutoDayVerdicts(input({ events, scheduleMinutesFor: () => 0 })).size).toBe(0);
    expect(buildAutoDayVerdicts(input({ events, holidayTimes: new Set([DAY.getTime()]) })).size).toBe(0);
  });

  it("uses the first check-in of the day", () => {
    expect(buildAutoDayVerdicts(input({ events: [checkIn("12:00"), checkIn("07:35")] })).size).toBe(0);
  });
});

describe("autoReasonLabel", () => {
  it("names what flagged the day", () => {
    expect(autoReasonLabel({ late: true, outsideLocation: false })).toBe("Terlambat");
    expect(autoReasonLabel({ late: false, outsideLocation: true })).toBe("Di luar lokasi");
    expect(autoReasonLabel({ late: true, outsideLocation: true })).toBe("Terlambat dan di luar lokasi");
  });
});

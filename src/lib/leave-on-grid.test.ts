import { describe, expect, it } from "vitest";
import { pickLeaveRequestForGridDay } from "./leave-on-grid";
import { computeDayMinutes } from "./attendance-hours";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const cuti = { startDate: d("2026-10-12"), endDate: d("2026-10-14"), absenceTypeCode: "CT" };
const base = {
  date: d("2026-10-13"),
  hasExplicitAbsenceCode: false,
  presentOverride: false,
  hasCheckIn: false,
  hasCheckOut: false,
  isScheduledToWork: true,
  requests: [cuti],
};

describe("pickLeaveRequestForGridDay", () => {
  it("covers a working day inside an approved request that has no punches", () => {
    expect(pickLeaveRequestForGridDay(base)).toBe(cuti);
  });
  it("covers the first and last day of the request", () => {
    expect(pickLeaveRequestForGridDay({ ...base, date: d("2026-10-12") })).toBe(cuti);
    expect(pickLeaveRequestForGridDay({ ...base, date: d("2026-10-14") })).toBe(cuti);
  });
  it("does not cover days outside the request", () => {
    expect(pickLeaveRequestForGridDay({ ...base, date: d("2026-10-11") })).toBeUndefined();
    expect(pickLeaveRequestForGridDay({ ...base, date: d("2026-10-15") })).toBeUndefined();
  });
  it("lets what Admin SDM entered win", () => {
    expect(pickLeaveRequestForGridDay({ ...base, hasExplicitAbsenceCode: true })).toBeUndefined();
    expect(pickLeaveRequestForGridDay({ ...base, presentOverride: true })).toBeUndefined();
  });
  it("does not cover a day the person actually worked", () => {
    expect(pickLeaveRequestForGridDay({ ...base, hasCheckIn: true, hasCheckOut: true })).toBeUndefined();
  });
  it("still covers a day with only one punch", () => {
    expect(pickLeaveRequestForGridDay({ ...base, hasCheckIn: true })).toBe(cuti);
  });
  it("does not cover a day off or a public holiday", () => {
    expect(pickLeaveRequestForGridDay({ ...base, isScheduledToWork: false })).toBeUndefined();
  });
});

describe("paid leave from a request on the grid", () => {
  const minutesFor = (shift: string, dayOfWeek: number) => (shift === "SHIFT_1" && dayOfWeek >= 1 && dayOfWeek <= 5 ? 465 : 0);
  it("pays the rostered shift's hours once the leave day carries that shift", () => {
    const minutes = computeDayMinutes(
      {
        dayOfWeek: 2,
        hasCheckIn: false,
        hasCheckOut: false,
        recordShiftType: "SHIFT_1",
        assignedShiftType: "SHIFT_1",
        absenceTypeCode: "CT",
        hoursMultiplier: 1,
        presentOverride: false,
      },
      minutesFor
    );
    expect(minutes).toBe(465);
  });
  it("unpaid leave (multiplier 0) pays nothing", () => {
    const minutes = computeDayMinutes(
      {
        dayOfWeek: 2,
        hasCheckIn: false,
        hasCheckOut: false,
        recordShiftType: "SHIFT_1",
        assignedShiftType: "SHIFT_1",
        absenceTypeCode: "IZ",
        hoursMultiplier: 0,
        presentOverride: false,
      },
      minutesFor
    );
    expect(minutes).toBe(0);
  });
});

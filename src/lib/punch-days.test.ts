import { describe, expect, it } from "vitest";
import { buildPunchDayLookup, punchDayKey } from "./punch-days";

// 2026-10-07 00:00 WIB is 2026-10-06T17:00:00Z.
const wib = (y: number, m: number, d: number, h: number, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 7, min));
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("buildPunchDayLookup", () => {
  it("marks a check-in at 2pm on that WIB day", () => {
    const lookup = buildPunchDayLookup([{ employeeId: "e1", eventType: "CHECK_IN", eventAt: wib(2026, 10, 7, 14) }]);
    expect(lookup.get(punchDayKey("e1", day(2026, 10, 7)))).toEqual({ hasCheckIn: true, hasCheckOut: false });
  });

  it("combines check-in and check-out of the same day", () => {
    const lookup = buildPunchDayLookup([
      { employeeId: "e1", eventType: "CHECK_IN", eventAt: wib(2026, 10, 7, 14) },
      { employeeId: "e1", eventType: "CHECK_OUT", eventAt: wib(2026, 10, 7, 17) },
    ]);
    expect(lookup.get(punchDayKey("e1", day(2026, 10, 7)))).toEqual({ hasCheckIn: true, hasCheckOut: true });
  });

  it("puts a punch just after midnight WIB on the next day, not the UTC date", () => {
    const lookup = buildPunchDayLookup([{ employeeId: "e1", eventType: "CHECK_OUT", eventAt: wib(2026, 10, 8, 0, 30) }]);
    expect(lookup.get(punchDayKey("e1", day(2026, 10, 8)))).toEqual({ hasCheckIn: false, hasCheckOut: true });
    expect(lookup.get(punchDayKey("e1", day(2026, 10, 7)))).toBeUndefined();
  });

  it("keeps employees apart", () => {
    const lookup = buildPunchDayLookup([{ employeeId: "e1", eventType: "CHECK_IN", eventAt: wib(2026, 10, 7, 8) }]);
    expect(lookup.get(punchDayKey("e2", day(2026, 10, 7)))).toBeUndefined();
  });
});

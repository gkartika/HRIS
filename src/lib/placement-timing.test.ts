import { describe, expect, it } from "vitest";
import { isFutureDated, shouldScheduleMove } from "./placement-timing";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("isFutureDated", () => {
  it("is false for today and for the past", () => {
    expect(isFutureDated(d("2026-10-08"), d("2026-10-08"))).toBe(false);
    expect(isFutureDated(d("2026-10-01"), d("2026-10-08"))).toBe(false);
  });
  it("is true only after today", () => {
    expect(isFutureDated(d("2026-10-09"), d("2026-10-08"))).toBe(true);
  });
});

describe("shouldScheduleMove", () => {
  const today = d("2026-10-08");
  it("schedules a future-dated move that replaces a current primary placement", () => {
    expect(shouldScheduleMove({ hasCurrentPrimary: true, effectiveDate: d("2026-11-01"), today })).toBe(true);
  });
  it("applies a move dated today or earlier at once", () => {
    expect(shouldScheduleMove({ hasCurrentPrimary: true, effectiveDate: today, today })).toBe(false);
    expect(shouldScheduleMove({ hasCurrentPrimary: true, effectiveDate: d("2026-09-01"), today })).toBe(false);
  });
  it("never schedules a first placement, there is nothing to keep in force", () => {
    expect(shouldScheduleMove({ hasCurrentPrimary: false, effectiveDate: d("2026-11-01"), today })).toBe(false);
  });
});

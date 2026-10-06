import { describe, expect, it } from "vitest";
import {
  RANGE_ERROR,
  dayCountInclusive,
  formatRangeLabel,
  rangeShortcuts,
  resolveVisibleRange,
  sameRange,
} from "./grid-date-range";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
// Payroll period 21 Sep – 20 Okt 2026 (30 days).
const period = { start: d(2026, 9, 21), end: d(2026, 10, 20) };

describe("resolveVisibleRange", () => {
  it("defaults to the whole period", () => {
    const { range, error } = resolveVisibleRange(period, undefined, undefined);
    expect(error).toBeNull();
    expect(range.isFull).toBe(true);
    expect(range.dayCount).toBe(30);
  });

  it("narrows to a valid range", () => {
    const { range } = resolveVisibleRange(period, "2026-10-05", "2026-10-11");
    expect(range.isFull).toBe(false);
    expect(range.dayCount).toBe(7);
    expect(range.from).toEqual(d(2026, 10, 5));
  });

  it("treats an open end as that end of the period", () => {
    expect(resolveVisibleRange(period, "2026-10-10", undefined).range.to).toEqual(period.end);
    expect(resolveVisibleRange(period, undefined, "2026-09-25").range.from).toEqual(period.start);
  });

  it("clamps dates outside the period", () => {
    const { range } = resolveVisibleRange(period, "2026-08-01", "2026-12-31");
    expect(range.isFull).toBe(true);
  });

  it("ignores malformed dates", () => {
    expect(resolveVisibleRange(period, "besok", "2026-10-11").range.from).toEqual(period.start);
  });

  it("reports from-after-to and falls back to the whole period", () => {
    const { range, error } = resolveVisibleRange(period, "2026-10-12", "2026-10-05");
    expect(error).toBe(RANGE_ERROR);
    expect(range.isFull).toBe(true);
  });

  it("accepts a single day", () => {
    const { range } = resolveVisibleRange(period, "2026-10-06", "2026-10-06");
    expect(range.dayCount).toBe(1);
  });
});

describe("rangeShortcuts", () => {
  const today = d(2026, 10, 6); // Tuesday

  it("offers all four inside the current period", () => {
    const keys = rangeShortcuts(period, today).map((s) => s.key);
    expect(keys).toEqual(["all", "today", "last7", "week"]);
  });

  it("last 7 days ends today and spans 7 days", () => {
    const s = rangeShortcuts(period, today).find((x) => x.key === "last7")!;
    expect(s.to).toEqual(today);
    expect(dayCountInclusive(s.from, s.to)).toBe(7);
  });

  it("week runs Monday to Sunday", () => {
    const s = rangeShortcuts(period, today).find((x) => x.key === "week")!;
    expect(s.from).toEqual(d(2026, 10, 5));
    expect(s.to).toEqual(d(2026, 10, 11));
  });

  it("cuts the week at the period start", () => {
    // Period starting on a Wednesday; today is the Friday of that week.
    const p = { start: d(2026, 10, 21), end: d(2026, 11, 20) };
    const s = rangeShortcuts(p, d(2026, 10, 23)).find((x) => x.key === "week")!;
    expect(s.from).toEqual(d(2026, 10, 21));
  });

  it("a sunday belongs to the week that started the Monday before", () => {
    const s = rangeShortcuts(period, d(2026, 10, 11)).find((x) => x.key === "week")!;
    expect(s.from).toEqual(d(2026, 10, 5));
  });

  it("a past period offers only whole period and its last 7 days", () => {
    const past = { start: d(2026, 8, 21), end: d(2026, 9, 20) };
    const shortcuts = rangeShortcuts(past, today);
    expect(shortcuts.map((x) => x.key)).toEqual(["all", "last7"]);
    expect(shortcuts[1].to).toEqual(past.end);
  });

  it("a future period offers only the whole period", () => {
    const future = { start: d(2026, 11, 21), end: d(2026, 12, 20) };
    expect(rangeShortcuts(future, today).map((x) => x.key)).toEqual(["all"]);
  });
});

describe("helpers", () => {
  it("sameRange compares both ends", () => {
    expect(sameRange({ from: d(2026, 10, 1), to: d(2026, 10, 2) }, { from: d(2026, 10, 1), to: d(2026, 10, 2) })).toBe(true);
    expect(sameRange({ from: d(2026, 10, 1), to: d(2026, 10, 2) }, { from: d(2026, 10, 1), to: d(2026, 10, 3) })).toBe(false);
  });

  it("formats the label", () => {
    expect(formatRangeLabel(d(2026, 10, 6), d(2026, 10, 6))).toBe("6 Okt");
    expect(formatRangeLabel(d(2026, 10, 5), d(2026, 10, 11))).toBe("5 – 11 Okt");
    expect(formatRangeLabel(d(2026, 9, 28), d(2026, 10, 3))).toBe("28 Sep – 3 Okt");
  });
});

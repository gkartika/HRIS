import { describe, it, expect } from "vitest";
import { resolveCutoffPeriod, previousCutoffPeriod, nextCutoffPeriod, formatCutoffParam, parseCutoffParam } from "./absence-cutoff";

describe("resolveCutoffPeriod", () => {
  it("a date on/after the 21st starts a period that same month", () => {
    const period = resolveCutoffPeriod(new Date(2026, 8, 21)); // 21 Sep 2026
    expect(period.start).toEqual(new Date(Date.UTC(2026, 8, 21)));
    expect(period.end).toEqual(new Date(Date.UTC(2026, 9, 20)));
  });

  it("a date on/before the 20th falls in the period starting the previous month's 21st", () => {
    const period = resolveCutoffPeriod(new Date(2026, 8, 20)); // 20 Sep 2026
    expect(period.start).toEqual(new Date(Date.UTC(2026, 7, 21)));
    expect(period.end).toEqual(new Date(Date.UTC(2026, 8, 20)));
  });

  it("crosses a year boundary correctly", () => {
    const period = resolveCutoffPeriod(new Date(2027, 0, 5)); // 5 Jan 2027
    expect(period.start).toEqual(new Date(Date.UTC(2026, 11, 21)));
    expect(period.end).toEqual(new Date(Date.UTC(2027, 0, 20)));
  });
});

describe("previousCutoffPeriod / nextCutoffPeriod", () => {
  it("are inverses of each other and never overlap", () => {
    const period = resolveCutoffPeriod(new Date(2026, 8, 21));
    const prev = previousCutoffPeriod(period);
    const next = nextCutoffPeriod(period);
    expect(prev.end.getTime()).toBe(period.start.getTime() - 24 * 60 * 60 * 1000);
    expect(next.start.getTime()).toBe(period.end.getTime() + 24 * 60 * 60 * 1000);
    expect(nextCutoffPeriod(prev).start).toEqual(period.start);
  });
});

describe("formatCutoffParam / parseCutoffParam", () => {
  it("round-trips a UTC-midnight date-only value", () => {
    const date = new Date(Date.UTC(2026, 8, 21));
    expect(parseCutoffParam(formatCutoffParam(date))).toEqual(date);
  });

  it("rejects malformed input", () => {
    expect(parseCutoffParam(undefined)).toBeNull();
    expect(parseCutoffParam("not-a-date")).toBeNull();
  });
});

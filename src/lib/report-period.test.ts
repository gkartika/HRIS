import { describe, it, expect } from "vitest";
import { resolveYearPeriod, resolvePeriod, previousPeriod, nextPeriod, parseReportView } from "./report-period";

describe("resolveYearPeriod", () => {
  it("resolves to the full calendar year containing the reference date", () => {
    const period = resolveYearPeriod(new Date(2026, 8, 15)); // 15 Sep 2026
    expect(period.start).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(period.end).toEqual(new Date(Date.UTC(2026, 11, 31)));
    expect(period.label).toBe("2026");
  });
});

describe("resolvePeriod", () => {
  it("dispatches to the matching resolver per view type", () => {
    const ref = new Date(2026, 8, 21);
    expect(resolvePeriod("year", ref)).toEqual(resolveYearPeriod(ref));
    expect(resolvePeriod("cycle", ref).label).toContain("2026");
  });
});

describe("previousPeriod / nextPeriod", () => {
  it("cycle view delegates to the payroll-cutoff steppers", () => {
    const period = resolvePeriod("cycle", new Date(2026, 8, 21));
    const next = nextPeriod("cycle", period);
    expect(next.start.getTime()).toBe(period.end.getTime() + 24 * 60 * 60 * 1000);
  });

  it("year view steps by a calendar year with no gap or overlap", () => {
    const period = resolveYearPeriod(new Date(2026, 8, 15)); // 2026
    const prev = previousPeriod("year", period);
    const next = nextPeriod("year", period);
    expect(prev.start).toEqual(new Date(Date.UTC(2025, 0, 1)));
    expect(next.start).toEqual(new Date(Date.UTC(2027, 0, 1)));
    expect(prev.end.getTime()).toBe(period.start.getTime() - 24 * 60 * 60 * 1000);
    expect(next.start.getTime()).toBe(period.end.getTime() + 24 * 60 * 60 * 1000);
  });
});

describe("parseReportView", () => {
  it("accepts known view values and defaults to cycle otherwise", () => {
    expect(parseReportView("cycle")).toBe("cycle");
    expect(parseReportView("year")).toBe("year");
    expect(parseReportView(undefined)).toBe("cycle");
    expect(parseReportView("bogus")).toBe("cycle");
  });
});

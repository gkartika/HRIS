import { describe, it, expect } from "vitest";
import { companyDateParts, companyYear, companyToday, startOfCompanyDay } from "./company-time";

describe("company time (Asia/Jakarta)", () => {
  it("05:00 WIB on 1 Jan is still 31 Dec on the UTC clock — company year is the new one", () => {
    const instant = new Date("2025-12-31T22:00:00Z"); // 05:00 WIB, 1 Jan 2026
    expect(companyYear(instant)).toBe(2026);
    expect(companyToday(instant).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("reads hour and weekday in WIB", () => {
    const parts = companyDateParts(new Date("2026-09-19T17:30:00Z")); // Sat 00:30 WIB on 20 Sep
    expect(parts).toMatchObject({ year: 2026, month: 9, day: 20, weekday: 0, hour: 0, minute: 30 });
  });

  it("a UTC-midnight date-only value keeps its calendar day", () => {
    expect(companyToday(new Date("2026-09-24T00:00:00Z")).toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });

  it("start of the company day is 00:00 WIB (17:00 UTC the day before)", () => {
    expect(startOfCompanyDay(new Date("2026-09-24T03:00:00Z")).toISOString()).toBe("2026-09-23T17:00:00.000Z");
  });
});

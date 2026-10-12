import { describe, expect, it } from "vitest";
import {
  addMonthsCompany,
  countByStatus,
  adjustmentDelta,
  cancelWouldGoNegative,
  evaluateIssueWarnings,
  issueDelta,
  nameSearchWords,
  nextEligibleDate,
  parseCompanyDateInput,
  stockStatus,
  suggestNextItemCode,
} from "./consumables";

// 00:00 WIB of a company-local day, as an instant.
const wib = (y: number, m: number, d: number, hour = 0) => new Date(Date.UTC(y, m - 1, d, hour - 7));

describe("stockStatus", () => {
  it("is HABIS at zero or below", () => {
    expect(stockStatus(0, 5)).toBe("HABIS");
    expect(stockStatus(-3, 5)).toBe("HABIS");
  });
  it("is MENIPIS at or under the minimum", () => {
    expect(stockStatus(5, 5)).toBe("MENIPIS");
    expect(stockStatus(1, 5)).toBe("MENIPIS");
  });
  it("is AMAN above the minimum", () => {
    expect(stockStatus(6, 5)).toBe("AMAN");
  });
  it("treats min 0 as AMAN while any stock is left", () => {
    expect(stockStatus(1, 0)).toBe("AMAN");
  });
});

describe("deltas", () => {
  it("stores an issue as negative", () => expect(issueDelta(3)).toBe(-3));
  it("adjusts to the physical count", () => {
    expect(adjustmentDelta(60, 55)).toBe(-5);
    expect(adjustmentDelta(10, 14)).toBe(4);
    expect(adjustmentDelta(10, 10)).toBe(0);
  });
});

describe("addMonthsCompany", () => {
  it("adds whole months", () => {
    expect(addMonthsCompany(wib(2026, 7, 2), 12)).toEqual(wib(2027, 7, 2));
  });
  it("clamps to the end of a shorter month", () => {
    expect(addMonthsCompany(wib(2026, 1, 31), 1)).toEqual(wib(2026, 2, 28));
    expect(addMonthsCompany(wib(2027, 12, 31), 2)).toEqual(wib(2028, 2, 29));
  });
  it("uses the WIB day, not the UTC day", () => {
    // 01:00 WIB on 2 Jul is still 1 Jul in UTC.
    expect(addMonthsCompany(wib(2026, 7, 2, 1), 1)).toEqual(wib(2026, 8, 2));
  });
});

describe("nextEligibleDate", () => {
  it("is null with no period or no prior take", () => {
    expect(nextEligibleDate(wib(2026, 7, 2), 0)).toBeNull();
    expect(nextEligibleDate(null, 12)).toBeNull();
  });
});

describe("evaluateIssueWarnings", () => {
  const base = { stock: 10, quantity: 1, lastIssueAt: null, periodMonths: 12, occurredAt: wib(2026, 10, 2) };

  it("has no warning for a first take that fits", () => {
    expect(evaluateIssueWarnings(base).hasWarning).toBe(false);
  });

  it("flags a take inside the replacement window", () => {
    const w = evaluateIssueWarnings({ ...base, lastIssueAt: wib(2026, 7, 2) });
    expect(w.beforePeriod).toBe(true);
    expect(w.nextEligible).toEqual(wib(2027, 7, 2));
  });

  it("does not flag on the eligible day itself", () => {
    const w = evaluateIssueWarnings({ ...base, lastIssueAt: wib(2025, 10, 2), occurredAt: wib(2026, 10, 2, 15) });
    expect(w.beforePeriod).toBe(false);
  });

  it("does not flag when the period is 0", () => {
    const w = evaluateIssueWarnings({ ...base, periodMonths: 0, lastIssueAt: wib(2026, 10, 1) });
    expect(w.beforePeriod).toBe(false);
  });

  it("exempts a department take (no lastIssueAt)", () => {
    expect(evaluateIssueWarnings({ ...base, lastIssueAt: null }).beforePeriod).toBe(false);
  });

  it("flags taking more than the stock and reports the shortfall", () => {
    const w = evaluateIssueWarnings({ ...base, stock: 3, quantity: 5 });
    expect(w.exceedsStock).toBe(true);
    expect(w.shortfall).toBe(2);
  });

  it("measures the shortfall from zero when stock is already negative", () => {
    const w = evaluateIssueWarnings({ ...base, stock: -2, quantity: 4 });
    expect(w.shortfall).toBe(4);
  });

  it("allows taking exactly what is left", () => {
    expect(evaluateIssueWarnings({ ...base, stock: 5, quantity: 5 }).exceedsStock).toBe(false);
  });
});

describe("cancelWouldGoNegative", () => {
  it("never flags cancelling an issue (it returns stock)", () => {
    expect(cancelWouldGoNegative(0, { type: "ISSUE", quantityDelta: -5 })).toBe(false);
  });
  it("flags cancelling a receipt that was already used", () => {
    expect(cancelWouldGoNegative(20, { type: "RECEIPT", quantityDelta: 100 })).toBe(true);
    expect(cancelWouldGoNegative(120, { type: "RECEIPT", quantityDelta: 100 })).toBe(false);
  });
});

describe("parseCompanyDateInput", () => {
  const now = new Date(Date.UTC(2026, 9, 6, 5, 0)); // 12:00 WIB, 6 Oct 2026

  it("keeps the current instant for a blank date or today", () => {
    expect(parseCompanyDateInput("", now)).toEqual(now);
    expect(parseCompanyDateInput("2026-10-06", now)).toEqual(now);
  });
  it("puts a past day at noon WIB", () => {
    expect(parseCompanyDateInput("2026-10-02", now)).toEqual(wib(2026, 10, 2, 12));
  });
  it("rejects a future day", () => {
    expect(parseCompanyDateInput("2026-10-07", now)).toBe("future");
  });
  it("rejects malformed and impossible dates", () => {
    expect(parseCompanyDateInput("06/10/2026", now)).toBe("invalid");
    expect(parseCompanyDateInput("2026-02-30", now)).toBe("invalid");
  });
  it("treats a late-evening UTC time as the next WIB day", () => {
    // 23:00 UTC on 5 Oct is already 6 Oct in WIB — so "2026-10-06" is today.
    const lateUtc = new Date(Date.UTC(2026, 9, 5, 23, 0));
    expect(parseCompanyDateInput("2026-10-06", lateUtc)).toEqual(lateUtc);
  });
});

describe("suggestNextItemCode", () => {
  it("continues after the highest numeric suffix in the category", () => {
    expect(suggestNextItemCode("APD", ["APD-001", "APD-031", "ATK-050", "APD-014"])).toBe("APD-032");
  });
  it("starts at 001 when the category is empty", () => {
    expect(suggestNextItemCode("ATK", ["APD-001"])).toBe("ATK-001");
  });
  it("ignores codes without a numeric suffix", () => {
    expect(suggestNextItemCode("APD", ["APD-X", "APD-007"])).toBe("APD-008");
  });
});

describe("countByStatus", () => {
  it("counts each stock status and zero-fills the rest", () => {
    expect(countByStatus([{ status: "AMAN" }, { status: "HABIS" }, { status: "HABIS" }])).toEqual({ AMAN: 1, MENIPIS: 0, HABIS: 2 });
    expect(countByStatus([])).toEqual({ AMAN: 0, MENIPIS: 0, HABIS: 0 });
  });
});

describe('nameSearchWords', () => {
  it('splits on spaces and dots, in any order, and drops empties', () => {
    expect(nameSearchWords('M Yusuf')).toEqual(['M', 'Yusuf']);
    expect(nameSearchWords('  yusuf   m ')).toEqual(['yusuf', 'm']);
    expect(nameSearchWords('M.YUSUF EFENDI')).toEqual(['M', 'YUSUF', 'EFENDI']);
    expect(nameSearchWords('Moh.Nudin')).toEqual(['Moh', 'Nudin']);
    expect(nameSearchWords('CBP-0080')).toEqual(['CBP-0080']);
    expect(nameSearchWords('  ')).toEqual([]);
  });
});

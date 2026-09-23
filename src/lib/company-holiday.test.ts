import { describe, it, expect } from "vitest";
import { parseHolidayLines } from "./company-holiday";

describe("parseHolidayLines", () => {
  it("parses multiple well-formed lines", () => {
    const result = parseHolidayLines("2026-01-01 Tahun Baru Masehi\n2026-08-17 Hari Kemerdekaan RI");
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].date).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(result.valid[0].label).toBe("Tahun Baru Masehi");
    expect(result.valid[1].date).toEqual(new Date(Date.UTC(2026, 7, 17)));
    expect(result.valid[1].label).toBe("Hari Kemerdekaan RI");
  });

  it("ignores blank lines", () => {
    const result = parseHolidayLines("2026-01-01 Tahun Baru\n\n\n2026-12-25 Natal");
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(2);
  });

  it("trims surrounding whitespace on each line", () => {
    const result = parseHolidayLines("  2026-01-01 Tahun Baru  \n");
    expect(result.valid[0].label).toBe("Tahun Baru");
  });

  it("rejects a line with no label", () => {
    const result = parseHolidayLines("2026-01-01");
    expect(result.valid).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Baris 1");
  });

  it("rejects a malformed date", () => {
    const result = parseHolidayLines("2026-13-01 Bulan tidak valid");
    expect(result.valid).toEqual([]);
    expect(result.errors[0]).toContain("Baris 1");
  });

  it("reports every bad line with its own line number, keeping numbering against the original input", () => {
    const result = parseHolidayLines("2026-01-01 OK\nnot-a-line\n2026-01-03 OK juga");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Baris 2");
    expect(result.valid).toHaveLength(2);
  });

  it("returns empty valid/errors for blank input", () => {
    const result = parseHolidayLines("   \n\n");
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

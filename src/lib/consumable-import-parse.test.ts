import { describe, expect, it } from "vitest";
import {
  dayKey,
  hasHeader,
  isArchivedStatus,
  isCancelledStatus,
  parseCategory,
  parseFlexibleDate,
  parseIntStrict,
  pick,
} from "./consumable-import-parse";

describe("pick / hasHeader", () => {
  const raw = { "Kode Barang": " APD-001 ", "Nama Karyawan": "Rindi", Jumlah: "" };
  it("matches headers ignoring case, spaces and punctuation", () => {
    expect(pick(raw, "kodeBarang", "Kode")).toBe("APD-001");
    expect(pick(raw, "nama_karyawan")).toBe("Rindi");
  });
  it("returns empty when no alias matches or the value is blank", () => {
    expect(pick(raw, "Satuan")).toBe("");
    expect(pick(raw, "Jumlah")).toBe("");
  });
  it("hasHeader looks at headers, not values", () => {
    expect(hasHeader(raw, "jumlah")).toBe(true);
    expect(hasHeader(raw, "stok fisik")).toBe(false);
  });
});

describe("parseFlexibleDate", () => {
  const wib = (y: number, m: number, d: number, h = 12, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 7, min));
  it("reads dd/mm/yyyy as day-first at noon WIB", () => {
    expect(parseFlexibleDate("02/10/2026")).toEqual(wib(2026, 10, 2));
    expect(parseFlexibleDate("2-10-2026")).toEqual(wib(2026, 10, 2));
  });
  it("reads two-digit years as 20yy", () => {
    expect(parseFlexibleDate("02/10/26")).toEqual(wib(2026, 10, 2));
  });
  it("reads ISO dates", () => {
    expect(parseFlexibleDate("2026-10-02")).toEqual(wib(2026, 10, 2));
  });
  it("honours a time as WIB wall-clock", () => {
    expect(parseFlexibleDate("02/10/2026 08:30")).toEqual(wib(2026, 10, 2, 8, 30));
    expect(parseFlexibleDate("2026-10-02 08:30:15")).toEqual(new Date(Date.UTC(2026, 9, 2, 1, 30, 15)));
  });
  it("rejects impossible dates and junk", () => {
    expect(parseFlexibleDate("31/02/2026")).toBeNull();
    expect(parseFlexibleDate("13/13/2026")).toBeNull();
    expect(parseFlexibleDate("kemarin")).toBeNull();
    expect(parseFlexibleDate("02/10/2026 25:00")).toBeNull();
  });
});

describe("small parsers", () => {
  it("parseIntStrict accepts whole numbers only", () => {
    expect(parseIntStrict("12")).toBe(12);
    expect(parseIntStrict("+20")).toBe(20);
    expect(parseIntStrict("-5")).toBe(-5);
    expect(parseIntStrict("1.5")).toBeNull();
    expect(parseIntStrict("1.000")).toBeNull();
    expect(parseIntStrict("")).toBeNull();
  });
  it("parseCategory", () => {
    expect(parseCategory(" apd ")).toBe("APD");
    expect(parseCategory("ATK")).toBe("ATK");
    expect(parseCategory("Lainnya")).toBeNull();
  });
  it("status words", () => {
    expect(isCancelledStatus("Dibatalkan")).toBe(true);
    expect(isCancelledStatus("Aktif")).toBe(false);
    expect(isArchivedStatus("Diarsipkan")).toBe(true);
    expect(isArchivedStatus("Aktif")).toBe(false);
  });
  it("dayKey uses the WIB day", () => {
    expect(dayKey(new Date(Date.UTC(2026, 9, 1, 18, 0)))).toBe("2026-10-02");
    expect(dayKey(new Date(Date.UTC(2026, 9, 1, 16, 0)))).toBe("2026-10-01");
  });
});

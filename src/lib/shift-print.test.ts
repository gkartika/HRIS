import { describe, expect, it } from "vitest";
import { printFilterText, shiftPrintLabel, weekPrintRange } from "./shift-print";

describe("shift print wording", () => {
  it("writes the Sunday-to-Saturday dates on top", () => {
    expect(weekPrintRange("2026-10-18")).toBe("Minggu 18 Okt 2026 – Sabtu 24 Okt 2026");
    expect(weekPrintRange("2026-12-27")).toBe("Minggu 27 Des 2026 – Sabtu 2 Jan 2027");
  });

  it("calls someone without a stored change Shift 1", () => {
    expect(shiftPrintLabel(null)).toBe("Shift 1");
    expect(shiftPrintLabel("SHIFT_2")).toBe("Shift 2");
    expect(shiftPrintLabel("NON_SHIFT")).toBe("Libur");
  });

  it("says what the sheet was limited to", () => {
    expect(printFilterText({ filter: "SHIFT_2", departmentName: null, groupName: null, search: "" })).toBe("Shift 2 · Semua departemen");
    expect(printFilterText({ filter: "all", departmentName: "Produksi", groupName: "Grup A", search: " budi " })).toBe(
      'Semua shift · Departemen: Produksi · Grup: Grup A · Pencarian "budi"'
    );
    expect(printFilterText({ filter: "default", departmentName: null, groupName: null, search: "" })).toBe("Shift 1 (belum diatur) · Semua departemen");
  });
});

import { describe, it, expect } from "vitest";
import { formatDayCode, minutesToDecimalHours, buildReconciliationExportSheet } from "./attendance-reconciliation-export";
import type { GridDayCell, GridEmployeeRow } from "./attendance-reconciliation-queue";

function makeCell(overrides: Partial<GridDayCell> = {}): GridDayCell {
  return {
    date: new Date(Date.UTC(2026, 8, 21)),
    shiftType: null,
    assignedShiftType: "SHIFT_1",
    absenceTypeCode: null,
    absenceTypeLabel: null,
    hasCheckIn: false,
    hasCheckOut: false,
    presentOverride: false,
    minutes: 0,
    actualMinutes: 0,
    ...overrides,
  };
}

describe("formatDayCode", () => {
  it("combines the absence code with the shift digit, e.g. CT1", () => {
    expect(formatDayCode(makeCell({ absenceTypeCode: "CT", shiftType: "SHIFT_1" }))).toBe("CT1");
  });

  it("uses the assigned shift's digit when the entry carries no explicit shiftType override", () => {
    expect(formatDayCode(makeCell({ absenceTypeCode: "SD", shiftType: null, assignedShiftType: "SHIFT_2" }))).toBe("SD2");
  });

  it("a Libur day is just \"L\", never combined with the absence code", () => {
    expect(formatDayCode(makeCell({ absenceTypeCode: "CT", shiftType: "NON_SHIFT" }))).toBe("L");
  });

  it("a Masuk (presentOverride) day reuses the plain shift digit, same as a real present day — no separate code", () => {
    expect(formatDayCode(makeCell({ presentOverride: true, shiftType: "SHIFT_2" }))).toBe("2");
  });

  it("a Masuk override on a Libur day is \"L\"", () => {
    expect(formatDayCode(makeCell({ presentOverride: true, shiftType: "NON_SHIFT" }))).toBe("L");
  });

  it("a real present day (no absence, no override) is just the shift digit", () => {
    expect(formatDayCode(makeCell({ hasCheckIn: true, hasCheckOut: true, shiftType: "SHIFT_3" }))).toBe("3");
  });

  it("a real present day on a Libur day is \"L\"", () => {
    expect(formatDayCode(makeCell({ hasCheckIn: true, hasCheckOut: true, shiftType: "NON_SHIFT" }))).toBe("L");
  });

  it("an unresolved day (no punch, no classification) is \"?\"", () => {
    expect(formatDayCode(makeCell())).toBe("?");
  });

  it("an explicit shift-only resolution (e.g. a holiday-calendar fill) shows the shift, even with no punch", () => {
    expect(formatDayCode(makeCell({ shiftType: "NON_SHIFT" }))).toBe("L");
    expect(formatDayCode(makeCell({ shiftType: "SHIFT_2" }))).toBe("2");
  });
});

describe("minutesToDecimalHours", () => {
  it("converts whole hours cleanly", () => {
    expect(minutesToDecimalHours(480)).toBe(8);
  });

  it("converts a partial hour to a 2-decimal fraction", () => {
    expect(minutesToDecimalHours(465)).toBe(7.75);
  });

  it("is 0 for 0 minutes", () => {
    expect(minutesToDecimalHours(0)).toBe(0);
  });
});

describe("buildReconciliationExportSheet", () => {
  const row: GridEmployeeRow = {
    employeeId: "emp1",
    employeeNumber: "EMP-0001",
    employeeName: "Test Employee",
    departmentName: "Production",
    points: -1,
    totalMinutes: 480,
    totalActualMinutes: 0,
    days: [
      makeCell({ absenceTypeCode: "CT", shiftType: "SHIFT_1", minutes: 480, actualMinutes: 0 }),
    ],
  };

  it("builds a header row with per-day Kode/Jam column pairs", () => {
    const sheet = buildReconciliationExportSheet([row]);
    expect(sheet[0]).toEqual(["No", "NIP", "Nama", "Departemen", "Poin", "Jam Kerja Gaji", "Jam Kerja Aktual", "Kode 21/09", "Jam 21/09"]);
  });

  it("builds one data row per employee with the formatted code and decimal hours", () => {
    const sheet = buildReconciliationExportSheet([row]);
    expect(sheet[1]).toEqual([1, "EMP-0001", "Test Employee", "Production", -1, 8, 0, "CT1", 8]);
  });

  it("returns just the header for an empty row set", () => {
    const sheet = buildReconciliationExportSheet([]);
    expect(sheet).toEqual([["No", "NIP", "Nama", "Departemen", "Poin", "Jam Kerja Gaji", "Jam Kerja Aktual"]]);
  });
});

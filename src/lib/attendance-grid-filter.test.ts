import { describe, expect, it } from "vitest";
import { dayTypeKey, filterGridRows, parseShiftParam, parseTypesParam } from "./attendance-grid-filter";
import type { GridDayCell, GridEmployeeRow } from "./attendance-reconciliation-queue";

function cell(day: number, over: Partial<GridDayCell> = {}): GridDayCell {
  return {
    date: new Date(Date.UTC(2026, 9, day)),
    shiftType: null,
    assignedShiftType: "SHIFT_1",
    absenceTypeCode: null,
    absenceTypeLabel: null,
    fromLeaveRequest: false,
    hasCheckIn: false,
    hasCheckOut: false,
    presentOverride: false,
    minutes: 0,
    actualMinutes: 0,
    ...over,
  };
}
const row = (name: string, days: GridDayCell[]): GridEmployeeRow => ({
  employeeId: name,
  employeeNumber: name,
  employeeName: name,
  departmentName: "—",
  points: 0,
  totalMinutes: 0,
  totalActualMinutes: 0,
  days,
});
const present = (day: number, shift = "SHIFT_1") => cell(day, { hasCheckIn: true, assignedShiftType: shift });
const all = () => true;

describe("dayTypeKey", () => {
  it("tells present, unresolved, day off and absence codes apart", () => {
    expect(dayTypeKey(present(5))).toBe("HADIR");
    expect(dayTypeKey(cell(5))).toBe("?");
    expect(dayTypeKey(cell(5, { shiftType: "NON_SHIFT", presentOverride: true }))).toBe("L");
    expect(dayTypeKey(cell(5, { absenceTypeCode: "SH", hasCheckIn: true }))).toBe("SH");
    expect(dayTypeKey(cell(5, { absenceTypeCode: "CT", fromLeaveRequest: true }))).toBe("CT");
  });
});

describe("filterGridRows", () => {
  const rows = [
    row("rokib", [present(5), cell(6, { absenceTypeCode: "SH", hasCheckIn: true }), present(7)]),
    row("dewi", [present(5, "SHIFT_2"), cell(6, { absenceTypeCode: "CT", assignedShiftType: "SHIFT_2" })]),
    row("budi", [present(5, "SHIFT_3"), cell(6, { assignedShiftType: "SHIFT_3" })]),
  ];

  it("returns everyone when nothing is chosen", () => {
    expect(filterGridRows(rows, { types: [], shift: null, inRange: all })).toHaveLength(3);
  });

  it("keeps employees who had any of the chosen types", () => {
    expect(filterGridRows(rows, { types: ["SH"], shift: null, inRange: all }).map((r) => r.employeeId)).toEqual(["rokib"]);
    expect(filterGridRows(rows, { types: ["SH", "CT"], shift: null, inRange: all }).map((r) => r.employeeId)).toEqual(["rokib", "dewi"]);
    expect(filterGridRows(rows, { types: ["?"], shift: null, inRange: all }).map((r) => r.employeeId)).toEqual(["budi"]);
  });

  it("keeps employees who were on the chosen shift on any shown day", () => {
    expect(filterGridRows(rows, { types: [], shift: "SHIFT_2", inRange: all }).map((r) => r.employeeId)).toEqual(["dewi"]);
    const changed = [row("hendra", [present(5, "SHIFT_1"), present(6, "SHIFT_2")])];
    expect(filterGridRows(changed, { types: [], shift: "SHIFT_2", inRange: all })).toHaveLength(1);
    expect(filterGridRows(changed, { types: [], shift: "SHIFT_1", inRange: all })).toHaveLength(1);
  });

  it("needs both the type and the shift when both are chosen", () => {
    expect(filterGridRows(rows, { types: ["CT"], shift: "SHIFT_1", inRange: all })).toHaveLength(0);
    expect(filterGridRows(rows, { types: ["CT"], shift: "SHIFT_2", inRange: all })).toHaveLength(1);
  });

  it("only looks at the days inside the shown range", () => {
    const onlyFifth = (d: Date) => d.getUTCDate() === 5;
    expect(filterGridRows(rows, { types: ["SH"], shift: null, inRange: onlyFifth })).toHaveLength(0);
  });
});

describe("param parsing", () => {
  it("reads types from one value, a list or a comma list and drops junk", () => {
    expect(parseTypesParam("SH")).toEqual(["SH"]);
    expect(parseTypesParam(["SH", "AL", "SH"])).toEqual(["SH", "AL"]);
    expect(parseTypesParam("SH,AL")).toEqual(["SH", "AL"]);
    expect(parseTypesParam(["<script>", "?"])).toEqual(["?"]);
    expect(parseTypesParam(undefined)).toEqual([]);
  });

  it("accepts only the three shifts", () => {
    expect(parseShiftParam("SHIFT_2")).toBe("SHIFT_2");
    expect(parseShiftParam("NON_SHIFT")).toBeNull();
    expect(parseShiftParam(undefined)).toBeNull();
  });
});

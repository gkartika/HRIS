import { describe, it, expect } from "vitest";
import { computeStructureWarnings, type OrgChartPosition } from "./org-chart";

function position(overrides: Partial<OrgChartPosition> & { id: string }): OrgChartPosition {
  return {
    positionCode: overrides.id,
    jobTitle: overrides.id,
    jobLevel: "1",
    orgUnitId: "unit-1",
    orgUnitName: "Unit",
    positionType: "STAFF",
    positionStatus: "VACANT",
    reportsToPositionId: null,
    occupants: [],
    ...overrides,
  };
}

describe("computeStructureWarnings (ORG-15)", () => {
  it("reports no warnings for a well-formed Director > Dept Head > Section Head chain", () => {
    const positions = [
      position({ id: "director", positionType: "DIRECTOR", reportsToPositionId: null }),
      position({ id: "depthead", positionType: "DEPARTMENT_HEAD", reportsToPositionId: "director" }),
      position({ id: "sechead", positionType: "SECTION_HEAD", reportsToPositionId: "depthead" }),
      position({ id: "staff", positionType: "STAFF", reportsToPositionId: "sechead" }),
    ];
    expect(computeStructureWarnings(positions)).toEqual([]);
  });

  it("warns when there is no Director root at all", () => {
    const positions = [
      position({ id: "depthead", positionType: "DEPARTMENT_HEAD", reportsToPositionId: null }),
    ];
    const warnings = computeStructureWarnings(positions);
    expect(warnings.some((w) => w.includes("Tidak ada Posisi Direktur"))).toBe(true);
  });

  it("warns when there is more than one Director root", () => {
    const positions = [
      position({ id: "director-1", positionType: "DIRECTOR", reportsToPositionId: null }),
      position({ id: "director-2", positionType: "DIRECTOR", reportsToPositionId: null }),
    ];
    const warnings = computeStructureWarnings(positions);
    expect(warnings.some((w) => w.includes("2 Posisi Direktur"))).toBe(true);
  });

  it("warns when a Department Head does not chain up to the Director", () => {
    const positions = [
      position({ id: "director", positionType: "DIRECTOR", reportsToPositionId: null }),
      position({ id: "orphan-depthead", positionType: "DEPARTMENT_HEAD", reportsToPositionId: null }),
    ];
    const warnings = computeStructureWarnings(positions);
    expect(warnings.some((w) => w.includes('"orphan-depthead" tidak berada di bawah hierarki Direktur'))).toBe(
      true
    );
  });

  it("warns about non-Director positions with no reports-to (ORG-02 style)", () => {
    const positions = [
      position({ id: "director", positionType: "DIRECTOR", reportsToPositionId: null }),
      position({ id: "stray-staff", positionType: "STAFF", reportsToPositionId: null }),
    ];
    const warnings = computeStructureWarnings(positions);
    expect(warnings.some((w) => w.includes("posisi lain tidak memiliki atasan"))).toBe(true);
  });

  it("does not loop forever on a circular reporting reference", () => {
    const positions = [
      position({ id: "a", positionType: "DEPARTMENT_HEAD", reportsToPositionId: "b" }),
      position({ id: "b", positionType: "DEPARTMENT_HEAD", reportsToPositionId: "a" }),
    ];
    expect(() => computeStructureWarnings(positions)).not.toThrow();
  });
});

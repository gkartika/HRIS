import { describe, it, expect } from "vitest";
import { buildOrgUnitTree, type OrgUnitNode } from "./org-unit-tree";

const units: OrgUnitNode[] = [
  { id: "d1", unitName: "Produksi", unitType: "DEPARTMENT", parentUnitId: null },
  { id: "s1", unitName: "CNC", unitType: "SECTION", parentUnitId: "d1" },
  { id: "g1", unitName: "CNC Lathe", unitType: "GROUP", parentUnitId: "s1" },
  { id: "t1", unitName: "Tim A", unitType: "TEAM", parentUnitId: "g1" },
  { id: "d2", unitName: "Human Capital", unitType: "DEPARTMENT", parentUnitId: null },
];

describe("buildOrgUnitTree", () => {
  const tree = buildOrgUnitTree(units);

  it("returns the unit itself first, then each ancestor up to the root", () => {
    expect(tree.ancestorChain("t1").map((u) => u.id)).toEqual(["t1", "g1", "s1", "d1"]);
  });

  it("resolves the Department from any depth, including a Department itself", () => {
    expect(tree.departmentOf("t1")?.id).toBe("d1");
    expect(tree.departmentOf("s1")?.id).toBe("d1");
    expect(tree.departmentOf("d2")?.id).toBe("d2");
  });

  it("resolves the Group from a Team or the Group itself", () => {
    expect(tree.groupOf("t1")?.id).toBe("g1");
    expect(tree.groupOf("g1")?.id).toBe("g1");
  });

  it("has no Group for a seat sitting above the Group tier", () => {
    expect(tree.groupOf("s1")).toBeNull();
    expect(tree.groupOf("d1")).toBeNull();
  });

  it("returns an empty chain / null for an unknown unit", () => {
    expect(tree.ancestorChain("nope")).toEqual([]);
    expect(tree.departmentOf("nope")).toBeNull();
  });

  it("stops instead of looping forever on a circular parent chain", () => {
    const loop = buildOrgUnitTree([
      { id: "a", unitName: "A", unitType: "SECTION", parentUnitId: "b" },
      { id: "b", unitName: "B", unitType: "SECTION", parentUnitId: "a" },
    ]);
    expect(loop.ancestorChain("a").map((u) => u.id)).toEqual(["a", "b"]);
    expect(loop.departmentOf("a")).toBeNull();
  });
});

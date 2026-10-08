import { describe, expect, it } from "vitest";
import { parseReportsTo, parseYesNo, singleHrManagerViolations } from "./position-rules";

describe("parseReportsTo", () => {
  it("treats blank as unchanged", () => {
    expect(parseReportsTo("")).toEqual({ kind: "UNCHANGED" });
    expect(parseReportsTo("   ")).toEqual({ kind: "UNCHANGED" });
    expect(parseReportsTo(undefined)).toEqual({ kind: "UNCHANGED" });
  });
  it("clears only on the keyword, case-insensitive", () => {
    expect(parseReportsTo("KOSONGKAN")).toEqual({ kind: "CLEAR" });
    expect(parseReportsTo(" kosongkan ")).toEqual({ kind: "CLEAR" });
  });
  it("sets a code otherwise", () => {
    expect(parseReportsTo(" POS-001 ")).toEqual({ kind: "SET", positionCode: "POS-001" });
  });
});

describe("parseYesNo", () => {
  it("reads Ya/Tidak/True/False and blank", () => {
    expect(parseYesNo("Ya")).toBe(true);
    expect(parseYesNo("true")).toBe(true);
    expect(parseYesNo("Tidak")).toBe(false);
    expect(parseYesNo("FALSE")).toBe(false);
    expect(parseYesNo("")).toBeNull();
    expect(parseYesNo("mungkin")).toBeNull();
  });
});

describe("singleHrManagerViolations", () => {
  const row = (index: number, positionCode: string, grantsHrManagerAccess: boolean | null) => ({
    index,
    positionCode,
    grantsHrManagerAccess,
  });

  it("allows one Ya when nobody holds the flag", () => {
    expect(singleHrManagerViolations([row(0, "A", true), row(1, "B", null)], []).size).toBe(0);
  });
  it("allows re-confirming the current holder", () => {
    expect(singleHrManagerViolations([row(0, "A", true)], ["A"]).size).toBe(0);
  });
  it("rejects every Ya row when the file has more than one", () => {
    const v = singleHrManagerViolations([row(0, "A", true), row(1, "B", true)], []);
    expect([...v.keys()]).toEqual([0, 1]);
  });
  it("rejects a Ya when another position still holds it", () => {
    const v = singleHrManagerViolations([row(0, "B", true)], ["A"]);
    expect(v.get(0)).toContain("A");
  });
  it("allows moving the flag when the old holder is set to Tidak in the same file", () => {
    expect(singleHrManagerViolations([row(0, "B", true), row(1, "A", false)], ["A"]).size).toBe(0);
  });
});

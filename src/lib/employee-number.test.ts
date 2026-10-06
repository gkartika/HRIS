import { describe, expect, it } from "vitest";
import { formatEmployeeNumber, parseEmployeeNumber } from "./employee-number";

describe("formatEmployeeNumber", () => {
  it("pads to four digits", () => {
    expect(formatEmployeeNumber(1)).toBe("CBP-0001");
    expect(formatEmployeeNumber(42)).toBe("CBP-0042");
    expect(formatEmployeeNumber(1234)).toBe("CBP-1234");
  });
  it("keeps counting past 9999", () => {
    expect(formatEmployeeNumber(10000)).toBe("CBP-10000");
  });
});

describe("parseEmployeeNumber", () => {
  it("reads the system format", () => {
    expect(parseEmployeeNumber("CBP-0004")).toBe(4);
    expect(parseEmployeeNumber(" CBP-0120 ")).toBe(120);
  });
  it("ignores other formats", () => {
    expect(parseEmployeeNumber("0027")).toBeNull();
    expect(parseEmployeeNumber("cbp-0001")).toBeNull();
    expect(parseEmployeeNumber("CBP-")).toBeNull();
    expect(parseEmployeeNumber("CBP-12A")).toBeNull();
  });
});

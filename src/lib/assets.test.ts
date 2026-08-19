import { describe, it, expect } from "vitest";
import {
  isCustodyOpen,
  isAssetAvailableForIndividualAssignment,
  canAllocateQuantity,
  computeAssetStatusAfterReturn,
  computeAvailableQuantityAfterReturn,
  blocksOffboarding,
} from "./assets";

describe("isCustodyOpen", () => {
  it("is open unless RETURNED", () => {
    expect(isCustodyOpen("ACTIVE")).toBe(true);
    expect(isCustodyOpen("RETURNED")).toBe(false);
  });
});

describe("isAssetAvailableForIndividualAssignment", () => {
  it("only AVAILABLE can be assigned", () => {
    expect(isAssetAvailableForIndividualAssignment("AVAILABLE")).toBe(true);
    expect(isAssetAvailableForIndividualAssignment("IN_USE")).toBe(false);
    expect(isAssetAvailableForIndividualAssignment("UNDER_REPAIR")).toBe(false);
    expect(isAssetAvailableForIndividualAssignment("DISPOSED")).toBe(false);
    expect(isAssetAvailableForIndividualAssignment("LOST_PENDING_REVIEW")).toBe(false);
    expect(isAssetAvailableForIndividualAssignment("RETIRED")).toBe(false);
  });
});

describe("canAllocateQuantity", () => {
  it("requires a positive request within what's available", () => {
    expect(canAllocateQuantity(10, 5)).toBe(true);
    expect(canAllocateQuantity(10, 10)).toBe(true);
    expect(canAllocateQuantity(10, 11)).toBe(false);
    expect(canAllocateQuantity(10, 0)).toBe(false);
    expect(canAllocateQuantity(0, 1)).toBe(false);
  });
});

describe("computeAssetStatusAfterReturn", () => {
  it("maps each inspection result to its terminal/return status", () => {
    expect(computeAssetStatusAfterReturn("GOOD")).toBe("AVAILABLE");
    expect(computeAssetStatusAfterReturn("NEEDS_REPAIR")).toBe("UNDER_REPAIR");
    expect(computeAssetStatusAfterReturn("LOST_OR_BEYOND_REPAIR")).toBe("DISPOSED");
  });
});

describe("computeAvailableQuantityAfterReturn", () => {
  it("rejoins the pool only when returned in GOOD condition", () => {
    expect(computeAvailableQuantityAfterReturn(5, 3, "GOOD")).toBe(8);
    expect(computeAvailableQuantityAfterReturn(5, 3, "NEEDS_REPAIR")).toBe(5);
    expect(computeAvailableQuantityAfterReturn(5, 3, "LOST_OR_BEYOND_REPAIR")).toBe(5);
  });
});

describe("blocksOffboarding", () => {
  it("only an open Employee-target custody blocks offboarding", () => {
    expect(blocksOffboarding("EMPLOYEE", "ACTIVE")).toBe(true);
    expect(blocksOffboarding("EMPLOYEE", "RETURNED")).toBe(false);
    expect(blocksOffboarding("DEPARTMENT", "ACTIVE")).toBe(false);
    expect(blocksOffboarding("LOCATION", "ACTIVE")).toBe(false);
  });
});

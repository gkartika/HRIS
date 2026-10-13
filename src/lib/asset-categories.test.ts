import { describe, expect, it } from "vitest";
import { ASSET_CATEGORIES, normalizeAssetCategory } from "./asset-categories";

describe("normalizeAssetCategory", () => {
  it("offers Umum, IT and Kendaraan", () => {
    expect([...ASSET_CATEGORIES]).toEqual(["Umum", "IT", "Kendaraan"]);
  });

  it("matches ignoring case and spaces and returns the official spelling", () => {
    expect(normalizeAssetCategory("it")).toBe("IT");
    expect(normalizeAssetCategory("  kendaraan ")).toBe("Kendaraan");
    expect(normalizeAssetCategory("UMUM")).toBe("Umum");
  });

  it("rejects anything else and treats blank as none", () => {
    expect(normalizeAssetCategory("IT Equipment")).toBeNull();
    expect(normalizeAssetCategory("")).toBeNull();
    expect(normalizeAssetCategory(undefined)).toBeNull();
  });
});

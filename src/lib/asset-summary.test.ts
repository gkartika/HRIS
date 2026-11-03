import { describe, expect, it } from "vitest";
import { summarizeAssets, type AssetForSummary } from "./asset-summary";

const one = (category: string | null, status: string): AssetForSummary => ({ category, status, trackingType: "INDIVIDUAL", totalQuantity: null, availableQuantity: null });
const qty = (category: string | null, total: number, available: number, status = "AVAILABLE"): AssetForSummary => ({ category, status, trackingType: "QUANTITY_TRACKED", totalQuantity: total, availableQuantity: available });

describe("summarizeAssets", () => {
  it("counts individual assets by status, per category", () => {
    const s = summarizeAssets([one("IT", "IN_USE"), one("IT", "IN_USE"), one("IT", "AVAILABLE"), one("Kendaraan", "AVAILABLE"), one("IT", "UNDER_REPAIR")]);
    expect(s.categories.find((c) => c.category === "IT")).toMatchObject({ inUse: 2, available: 1, other: 1, total: 4, records: 4 });
    expect(s.categories.find((c) => c.category === "Kendaraan")).toMatchObject({ inUse: 0, available: 1, other: 0, total: 1 });
    expect(s).toMatchObject({ inUse: 2, available: 2, other: 1, total: 5 });
  });

  it("counts a quantity-tracked asset in units: what is handed out is in use", () => {
    const s = summarizeAssets([qty("Umum", 10, 7), qty("Umum", 5, 5)]);
    expect(s.categories[0]).toMatchObject({ category: "Umum", inUse: 3, available: 12, other: 0, total: 15, records: 2 });
  });

  it("a quantity-tracked asset out of circulation counts all its units as other", () => {
    expect(summarizeAssets([qty("Umum", 4, 4, "UNDER_REPAIR")])).toMatchObject({ inUse: 0, available: 0, other: 4, total: 4 });
  });

  it("leaves retired and disposed assets out, and keeps an impossible available quantity inside the total", () => {
    const s = summarizeAssets([one("IT", "RETIRED"), one("IT", "DISPOSED"), qty("Umum", 3, 9), qty("Umum", 3, -2)]);
    expect(s.categories).toHaveLength(1);
    expect(s.categories[0]).toMatchObject({ inUse: 3, available: 3, total: 6 });
  });

  it("orders the categories like the dropdown, then the rest, and names the uncategorised", () => {
    const s = summarizeAssets([one("Kendaraan", "AVAILABLE"), one(null, "AVAILABLE"), one("Lama", "AVAILABLE"), one("IT", "AVAILABLE"), one("Umum", "AVAILABLE")]);
    expect(s.categories.map((c) => c.category)).toEqual(["Umum", "IT", "Kendaraan", "Lama", "Tanpa kategori"]);
    expect(s.categories.at(-1)?.categoryFilter).toBeNull();
  });

  it("is empty when there are no assets", () => {
    expect(summarizeAssets([])).toEqual({ inUse: 0, available: 0, other: 0, total: 0, categories: [] });
  });
});

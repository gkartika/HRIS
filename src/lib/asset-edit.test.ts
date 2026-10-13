import { describe, expect, it } from "vitest";
import { planQuantityEdit } from "./asset-edit";

const base = { currentTracking: "QUANTITY_TRACKED" as const, currentTotal: 10, currentAvailable: 7, hasCustodyHistory: true, newTracking: "QUANTITY_TRACKED" as const, newTotal: 10 };

describe("planQuantityEdit", () => {
  it("keeps the units that are out when the total changes", () => {
    expect(planQuantityEdit({ ...base, newTotal: 20 })).toEqual({ trackingType: "QUANTITY_TRACKED", totalQuantity: 20, availableQuantity: 17 });
    expect(planQuantityEdit({ ...base, newTotal: 3 })).toEqual({ trackingType: "QUANTITY_TRACKED", totalQuantity: 3, availableQuantity: 0 });
  });

  it("refuses a total below what is currently out", () => {
    expect(planQuantityEdit({ ...base, newTotal: 2 })).toMatchObject({ error: expect.stringContaining("3 unit") });
  });

  it("needs a positive whole number", () => {
    for (const bad of [0, -1, 2.5, null]) expect(planQuantityEdit({ ...base, newTotal: bad })).toHaveProperty("error");
  });

  it("changes tracking type only while the asset has never been handed over", () => {
    const individual = { currentTracking: "INDIVIDUAL" as const, currentTotal: null, currentAvailable: null, hasCustodyHistory: false, newTracking: "QUANTITY_TRACKED" as const, newTotal: 5 };
    expect(planQuantityEdit(individual)).toEqual({ trackingType: "QUANTITY_TRACKED", totalQuantity: 5, availableQuantity: 5 });
    expect(planQuantityEdit({ ...individual, hasCustodyHistory: true })).toHaveProperty("error");
    expect(planQuantityEdit({ ...individual, newTotal: null })).toHaveProperty("error");
    expect(
      planQuantityEdit({ ...base, hasCustodyHistory: false, currentTotal: 5, currentAvailable: 5, newTracking: "INDIVIDUAL", newTotal: null })
    ).toEqual({ trackingType: "INDIVIDUAL", totalQuantity: null, availableQuantity: null });
  });

  it("leaves an Individual asset without quantities", () => {
    expect(planQuantityEdit({ currentTracking: "INDIVIDUAL", currentTotal: null, currentAvailable: null, hasCustodyHistory: true, newTracking: "INDIVIDUAL", newTotal: 9 })).toEqual({
      trackingType: "INDIVIDUAL",
      totalQuantity: null,
      availableQuantity: null,
    });
  });
});

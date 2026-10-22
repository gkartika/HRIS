import { describe, expect, it } from "vitest";
import { countBySource, describeSources, FULFILLMENT_SOURCE_LABEL, MOVEMENT_ORIGIN_LABEL } from "./recruitment-source";

describe("countBySource", () => {
  it("gives one total with the detail of the three ways", () => {
    const c = countBySource(["RECRUITMENT_EXTERNAL", "RECRUITMENT_INTERNAL", "MUTASI", "MUTASI"]);
    expect(c).toEqual({ total: 4, RECRUITMENT_EXTERNAL: 1, RECRUITMENT_INTERNAL: 1, MUTASI: 2 });
  });

  it("is all zeros for an empty list", () => {
    expect(countBySource([])).toEqual({ total: 0, RECRUITMENT_EXTERNAL: 0, RECRUITMENT_INTERNAL: 0, MUTASI: 0 });
  });
});

describe("describeSources", () => {
  it("lists only the ways that were used, in a fixed order", () => {
    expect(describeSources(countBySource(["MUTASI", "RECRUITMENT_EXTERNAL"]))).toBe("1 Rekrutmen eksternal · 1 Mutasi");
    expect(describeSources(countBySource([]))).toBe("");
  });
});

describe("labels", () => {
  it("use the three agreed names", () => {
    expect(FULFILLMENT_SOURCE_LABEL).toEqual({ RECRUITMENT_EXTERNAL: "Rekrutmen eksternal", RECRUITMENT_INTERNAL: "Rekrutmen internal", MUTASI: "Mutasi" });
    expect(MOVEMENT_ORIGIN_LABEL).toEqual({ REKRUTMEN_INTERNAL: "Rekrutmen internal", MUTASI: "Mutasi" });
  });
});

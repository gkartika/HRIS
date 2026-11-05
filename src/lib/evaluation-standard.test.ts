import { describe, expect, it } from "vitest";
import { buildCriterionStandard, chosenVariant, isCriterionStandard, levelText, levelsFromTexts, parseLevelList, pickVariantKey, standardProblem, textLines, type CriterionStandardSource, type VariantRule } from "./evaluation-standard";

const decision: VariantRule[] = [
  { key: "LEVEL_RENDAH", sortOrder: 0, appliesToLevels: "HL,1A,1B,1C,2A,2B", appliesToSubordinates: null },
  { key: "LEVEL_TINGGI", sortOrder: 1, appliesToLevels: "2C,3A,3B,4A,5A,DIRECTOR", appliesToSubordinates: null },
];
const leadership: VariantRule[] = [
  { key: "INDIVIDU", sortOrder: 0, appliesToLevels: null, appliesToSubordinates: false },
  { key: "BAWAHAN", sortOrder: 1, appliesToLevels: null, appliesToSubordinates: true },
];
const ctx = (jobLevel: string | null, employmentStatus = "PKWT", hasSubordinates = false) => ({ jobLevel, employmentStatus, hasSubordinates });

describe("pickVariantKey", () => {
  it("chooses by job level", () => {
    expect(pickVariantKey(decision, ctx("1C"))).toBe("LEVEL_RENDAH");
    expect(pickVariantKey(decision, ctx("1A"))).toBe("LEVEL_RENDAH");
    expect(pickVariantKey(decision, ctx("2B"))).toBe("LEVEL_RENDAH");
    expect(pickVariantKey(decision, ctx("2C"))).toBe("LEVEL_TINGGI");
    expect(pickVariantKey(decision, ctx("3b"))).toBe("LEVEL_TINGGI");
    expect(pickVariantKey(decision, ctx("5A"))).toBe("LEVEL_TINGGI");
  });
  it("Harian Lepas always gets the first version, whatever the level", () => {
    expect(pickVariantKey(decision, ctx("2C", "HARIAN_LEPAS"))).toBe("LEVEL_RENDAH");
    expect(pickVariantKey(decision, ctx(null, "HARIAN_LEPAS"))).toBe("LEVEL_RENDAH");
  });
  it("chooses by whether the person has people reporting to them", () => {
    expect(pickVariantKey(leadership, ctx("1C", "PKWT", false))).toBe("INDIVIDU");
    expect(pickVariantKey(leadership, ctx("2B", "PKWTT", true))).toBe("BAWAHAN");
  });
  it("returns null when no version is meant for the person", () => {
    expect(pickVariantKey(decision, ctx(null))).toBeNull();
    expect(pickVariantKey(decision, ctx("9Z"))).toBeNull();
    expect(pickVariantKey([], ctx("1A"))).toBeNull();
  });
});

const source = (over: Partial<CriterionStandardSource> = {}): CriterionStandardSource => ({
  definition: " Definisi ",
  note: null,
  variants: [],
  levels: [
    { variantKey: "DEFAULT", score: 2, description: "Dua" },
    { variantKey: "DEFAULT", score: 10, description: " Sepuluh " },
    { variantKey: "DEFAULT", score: 6, description: "  " },
  ],
  ...over,
});

describe("buildCriterionStandard", () => {
  it("a criterion with one set of texts: levels from the highest down, empty ones left out", () => {
    const s = buildCriterionStandard(source(), ctx("1C"));
    expect(s?.definition).toBe("Definisi");
    expect(s?.chosen).toBe("DEFAULT");
    expect(s?.variants).toHaveLength(1);
    expect(s?.variants[0].levels.map((l) => l.score)).toEqual([10, 2]);
    expect(levelText(s, 10)).toBe("Sepuluh");
    expect(levelText(s, 6)).toBeNull();
  });

  it("a criterion with versions: the right one is chosen, Admin SDM can override, and all versions are kept", () => {
    const withVariants = source({
      variants: decision.map((r, i) => ({ key: r.key, label: i === 0 ? "Rendah" : "Tinggi", sortOrder: r.sortOrder, appliesToLevels: r.appliesToLevels, appliesToSubordinates: null })),
      levels: [
        { variantKey: "LEVEL_RENDAH", score: 8, description: "R8" },
        { variantKey: "LEVEL_TINGGI", score: 8, description: "T8" },
      ],
    });
    const auto = buildCriterionStandard(withVariants, ctx("2C"));
    expect(auto?.chosen).toBe("LEVEL_TINGGI");
    expect(levelText(auto, 8)).toBe("T8");
    expect(levelText(auto, 8, "LEVEL_RENDAH")).toBe("R8");
    expect(chosenVariant(auto)?.label).toBe("Tinggi");
    expect(buildCriterionStandard(withVariants, ctx("2C"), "LEVEL_RENDAH")?.chosen).toBe("LEVEL_RENDAH");
    expect(buildCriterionStandard(withVariants, ctx("2C"), "NOPE")?.chosen).toBe("LEVEL_TINGGI");
    expect(buildCriterionStandard(withVariants, ctx(null))?.chosen).toBe("LEVEL_RENDAH");
  });

  it("has no standard when there is nothing to show", () => {
    expect(buildCriterionStandard(source({ definition: null, levels: [] }), ctx("1A"))).toBeNull();
  });
});

describe("helpers", () => {
  it("shows a text with several lines as a list", () => {
    expect(textLines("a\n b \r\n\n c")).toEqual(["a", "b", "c"]);
    expect(textLines("satu kalimat")).toEqual(["satu kalimat"]);
  });

  it("recognises a stored standard and rejects other shapes", () => {
    const s = buildCriterionStandard(source(), ctx("1A"));
    expect(isCriterionStandard(s)).toBe(true);
    expect(isCriterionStandard(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isCriterionStandard(null)).toBe(false);
    expect(isCriterionStandard({ chosen: "x", variants: [{ key: "x" }] })).toBe(false);
  });

  it("reads the settings texts for a scale and refuses too long a text", () => {
    const texts: Record<number, string> = { 0: " a ", 25: "", 50: "b\r\nc", 75: "  ", 100: "d" };
    expect(levelsFromTexts([0, 25, 50, 75, 100], (n) => texts[n])).toEqual([{ score: 0, description: "a" }, { score: 50, description: "b\nc" }, { score: 100, description: "d" }]);
    expect(standardProblem({ definition: "ok", note: "", levels: [] })).toBeNull();
    expect(standardProblem({ definition: "x".repeat(2001), note: "", levels: [] })).toContain("maksimal");
    expect(standardProblem({ definition: "", note: "", levels: [{ score: 6, description: "x".repeat(2001) }] })).toContain("nilai 6");
  });

  it("checks the list of levels typed by Admin SDM", () => {
    const known = ["1A", "1B", "2C", "3A"];
    expect(parseLevelList(" 1a, 1B ,hl,1a", known)).toEqual({ ok: true, value: "1A,1B,HL" });
    expect(parseLevelList("", known)).toEqual({ ok: true, value: null });
    expect(parseLevelList("1A, 9Z", known)).toEqual({ ok: false, error: "Level tidak dikenal: 9Z." });
    expect(parseLevelList("Director", known)).toEqual({ ok: true, value: "DIRECTOR" });
  });
});

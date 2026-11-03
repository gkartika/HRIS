import { describe, expect, it } from "vitest";
import { levelDescription, levelTitle, levelsFromForm, resolveStandard, standardProblem, STANDARD_TEXT_MAX, type StandardSource } from "./interview-standard";

const levels = [
  { score: 2, description: "Dua" },
  { score: 10, description: " Sepuluh " },
  { score: 6, description: "Enam" },
];

describe("resolveStandard", () => {
  it("lists the levels from 10 down to 2 and trims the texts", () => {
    const s = resolveStandard({ id: "u", definition: " Definisi ", note: null, levels });
    expect(s?.definition).toBe("Definisi");
    expect(s?.levels.map((l) => l.score)).toEqual([10, 6, 2]);
    expect(s?.levels[0].description).toBe("Sepuluh");
  });

  it("an aspect that shares uses the standard of the other, and keeps a note of its own", () => {
    const user: StandardSource = { id: "u", definition: "D", note: "Catatan user", levels };
    const hr: StandardSource = { id: "h", definition: null, note: null, levels: [], standardOf: user };
    expect(resolveStandard(hr)).toEqual({ definition: "D", note: "Catatan user", levels: resolveStandard(user)!.levels });
    expect(resolveStandard({ ...hr, note: "Catatan HR" })?.note).toBe("Catatan HR");
  });

  it("has no standard when there is nothing to show, and ignores scores outside 2-10", () => {
    expect(resolveStandard({ id: "e", definition: null, note: null, levels: [] })).toBeNull();
    expect(resolveStandard({ id: "e", definition: "  ", note: " ", levels: [{ score: 3, description: "x" }, { score: 4, description: "  " }] })).toBeNull();
  });
});

describe("helpers", () => {
  it("finds the text of one score", () => {
    const s = resolveStandard({ id: "u", definition: "D", note: null, levels });
    expect(levelDescription(s, 6)).toBe("Enam");
    expect(levelDescription(s, 4)).toBeNull();
    expect(levelDescription(null, 6)).toBeNull();
  });

  it("titles a score with its name", () => {
    expect(levelTitle(8)).toBe("8 · Baik");
    expect(levelTitle(2)).toBe("2 · Sangat kurang");
  });

  it("keeps only the filled boxes of the settings form", () => {
    const texts: Record<number, string> = { 2: " a ", 4: "", 6: "  ", 8: "b", 10: "" };
    expect(levelsFromForm((n) => texts[n])).toEqual([{ score: 2, description: "a" }, { score: 8, description: "b" }]);
  });

  it("refuses a text that is too long", () => {
    expect(standardProblem({ definition: "ok", note: "", levels: [{ score: 2, description: "x" }] })).toBeNull();
    expect(standardProblem({ definition: "x".repeat(STANDARD_TEXT_MAX + 1), note: "", levels: [] })).toContain("maksimal");
    expect(standardProblem({ definition: "", note: "", levels: [{ score: 6, description: "x".repeat(STANDARD_TEXT_MAX + 1) }] })).toContain("nilai 6");
  });
});

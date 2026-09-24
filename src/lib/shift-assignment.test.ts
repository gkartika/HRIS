import { describe, it, expect } from "vitest";
import { normalizeWeekStart } from "./shift-assignment";

// The company's week is Sunday to Saturday (e.g. 20-26 Sep 2026).
describe("normalizeWeekStart", () => {
  it("a Wednesday normalizes back to that same week's Sunday", () => {
    // 2026-08-05 is a Wednesday; its week started Sunday 2026-08-02.
    const result = normalizeWeekStart(new Date("2026-08-05T00:00:00Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-02");
  });

  it("a Saturday still belongs to the week that started the Sunday before", () => {
    // 2026-08-08 is a Saturday, the last day of the week starting 2026-08-02.
    const result = normalizeWeekStart(new Date("2026-08-08T00:00:00Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-02");
  });

  it("a Sunday normalizes to itself and starts a new week", () => {
    const result = normalizeWeekStart(new Date("2026-08-09T00:00:00Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-09");
  });

  it("matches the real example: 20-26 Sep 2026", () => {
    for (const day of ["2026-09-20", "2026-09-23", "2026-09-26"]) {
      expect(normalizeWeekStart(new Date(`${day}T00:00:00Z`)).toISOString().slice(0, 10)).toBe("2026-09-20");
    }
  });
});

import { describe, it, expect } from "vitest";
import { normalizeWeekStart } from "./shift-assignment";

describe("normalizeWeekStart", () => {
  it("a Wednesday normalizes back to that same week's Monday", () => {
    // 2026-08-05 is a Wednesday.
    const result = normalizeWeekStart(new Date("2026-08-05T00:00:00Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("a Sunday normalizes back to the Monday that started that same week", () => {
    // 2026-08-09 is a Sunday — still part of the week that started 2026-08-03.
    const result = normalizeWeekStart(new Date("2026-08-09T00:00:00Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("a Monday normalizes to itself", () => {
    const result = normalizeWeekStart(new Date("2026-08-03T00:00:00Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-03");
  });
});

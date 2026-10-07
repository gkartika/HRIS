import { describe, expect, it } from "vitest";
import { resolveAssignmentStart } from "./assignment-start";

describe("resolveAssignmentStart", () => {
  const now = new Date("2026-10-07T07:30:00Z"); // 14:30 WIB

  it("uses the date typed in the file", () => {
    expect(resolveAssignmentStart("2025-03-01", new Date("2020-01-01"), now).toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("blank: falls back to the employee's hire date", () => {
    expect(resolveAssignmentStart("", new Date("2024-06-15T00:00:00Z"), now).toISOString()).toBe("2024-06-15T00:00:00.000Z");
    expect(resolveAssignmentStart(undefined, new Date("2024-06-15T00:00:00Z"), now).toISOString()).toBe("2024-06-15T00:00:00.000Z");
  });

  it("blank and no hire date: today (company date)", () => {
    expect(resolveAssignmentStart("  ", null, now).toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("a hire date in the future is not used as the start", () => {
    expect(resolveAssignmentStart("", new Date("2027-01-01T00:00:00Z"), now).toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("never later than now, even just after midnight WIB", () => {
    const earlyMorning = new Date("2026-10-06T19:00:00Z"); // 02:00 WIB on 7 Oct
    expect(resolveAssignmentStart("", null, earlyMorning).getTime()).toBeLessThanOrEqual(earlyMorning.getTime());
  });
});

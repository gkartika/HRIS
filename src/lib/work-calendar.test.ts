import { describe, it, expect } from "vitest";
import { addWorkingDays, isOverdue } from "./work-calendar";

describe("addWorkingDays", () => {
  it("skips a weekend entirely (Fri + 1 -> Mon)", () => {
    const friday = new Date("2026-08-07"); // Friday
    const result = addWorkingDays(friday, 1);
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-10"); // Monday
  });

  it("adds 5 working days from a Monday, landing the following Monday", () => {
    const monday = new Date("2026-08-03"); // Monday
    const result = addWorkingDays(monday, 5);
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-10"); // next Monday
  });

  it("adds 5 working days spanning a weekend mid-week", () => {
    const wednesday = new Date("2026-08-05"); // Wednesday
    const result = addWorkingDays(wednesday, 5);
    // Thu, Fri, (skip Sat/Sun), Mon, Tue, Wed -> 2026-08-12
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-12");
  });
});

describe("isOverdue", () => {
  it("is false with no due date", () => {
    expect(isOverdue(null, new Date("2026-08-10"))).toBe(false);
  });

  it("is false exactly at the due date", () => {
    const due = new Date("2026-08-10T12:00:00");
    expect(isOverdue(due, new Date("2026-08-10T12:00:00"))).toBe(false);
  });

  it("is true after the due date", () => {
    const due = new Date("2026-08-10T12:00:00");
    expect(isOverdue(due, new Date("2026-08-10T12:00:01"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { holderIsLeaving, leavingSeatLabel } from "./leaving-holder";

describe("a holder who is leaving", () => {
  const day = new Date("2026-10-29T00:00:00Z");
  it("counts when the exit case is still waiting for clearance", () => {
    expect(holderIsLeaving([{ status: "PENDING_CLEARANCE", lastWorkingDay: day }])).toBe(true);
  });
  it("does not count when the case is finished or cancelled, or there is none", () => {
    expect(holderIsLeaving([{ status: "COMPLETED", lastWorkingDay: day }])).toBe(false);
    expect(holderIsLeaving([{ status: "CANCELLED", lastWorkingDay: day }])).toBe(false);
    expect(holderIsLeaving([])).toBe(false);
  });
  it("words the seat label", () => {
    expect(leavingSeatLabel("Reza Dwika Aulia", day)).toBe("akan kosong: Reza Dwika Aulia keluar 29 Okt");
  });
});

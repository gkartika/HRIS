import { describe, it, expect } from "vitest";
import { deriveEmployeeLifecycleStatus } from "./employee-lifecycle";

describe("deriveEmployeeLifecycleStatus", () => {
  const now = new Date("2026-08-05T00:00:00Z");

  it("activeFlag false is always OUT, regardless of hireDate", () => {
    expect(deriveEmployeeLifecycleStatus(false, new Date("2020-01-01"), now)).toBe("OUT");
    expect(deriveEmployeeLifecycleStatus(false, new Date("2030-01-01"), now)).toBe("OUT");
  });

  it("activeFlag true with a future hireDate is AKAN_MASUK", () => {
    expect(deriveEmployeeLifecycleStatus(true, new Date("2026-09-01"), now)).toBe("AKAN_MASUK");
  });

  it("activeFlag true with a past or today hireDate is ACTIVE", () => {
    expect(deriveEmployeeLifecycleStatus(true, new Date("2020-01-01"), now)).toBe("ACTIVE");
    expect(deriveEmployeeLifecycleStatus(true, now, now)).toBe("ACTIVE");
  });

  it("no hire date recorded: ACTIVE when active, OUT when not", () => {
    expect(deriveEmployeeLifecycleStatus(true, null, now)).toBe("ACTIVE");
    expect(deriveEmployeeLifecycleStatus(false, null, now)).toBe("OUT");
  });
});

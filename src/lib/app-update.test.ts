import { describe, expect, it } from "vitest";
import { updateAction } from "./app-update";

const base = { mine: "build-1", live: "build-2", visible: true, alreadyReloadedFor: null as string | null };

describe("updateAction", () => {
  it("does nothing when the page is current or the live build is unknown", () => {
    expect(updateAction({ ...base, live: "build-1" })).toBe("none");
    expect(updateAction({ ...base, live: "" })).toBe("none");
    expect(updateAction({ ...base, mine: "" })).toBe("none");
  });

  it("asks first when the person is looking at the page", () => {
    expect(updateAction(base)).toBe("banner");
  });

  it("refreshes quietly when the person is away", () => {
    expect(updateAction({ ...base, visible: false })).toBe("reload");
  });

  it("never reloads twice for the same live build", () => {
    expect(updateAction({ ...base, visible: false, alreadyReloadedFor: "build-2" })).toBe("banner");
    expect(updateAction({ ...base, visible: false, alreadyReloadedFor: "build-0" })).toBe("reload");
  });
});

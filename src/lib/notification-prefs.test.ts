import { describe, expect, it } from "vitest";
import { countLabel, DEFAULT_PREFS, prefsFromAccount, prefsFromForm, titleWithCount } from "./notification-prefs";

describe("prefsFromForm", () => {
  it("reads ticked boxes as on and missing ones as off", () => {
    const fd = new FormData();
    fd.set("icon", "on");
    fd.set("tab", "on");
    expect(prefsFromForm(fd)).toEqual({ icon: true, menu: false, tab: true });
  });

  it("is all off for an empty form", () => {
    expect(prefsFromForm(new FormData())).toEqual({ icon: false, menu: false, tab: false });
  });
});

describe("prefsFromAccount", () => {
  it("maps the account columns", () => {
    expect(prefsFromAccount({ notifyIconBadge: true, notifyMenuBadge: false, notifyTabTitle: true })).toEqual({ icon: true, menu: false, tab: true });
  });

  it("defaults to everything on", () => {
    expect(DEFAULT_PREFS).toEqual({ icon: true, menu: true, tab: true });
  });
});

describe("countLabel", () => {
  it("caps at 99+", () => {
    expect(countLabel(3)).toBe("3");
    expect(countLabel(99)).toBe("99");
    expect(countLabel(100)).toBe("99+");
  });
});

describe("titleWithCount", () => {
  it("puts the number in front when on and something is waiting", () => {
    expect(titleWithCount("SAPA", 3, true)).toBe("(3) SAPA");
  });

  it("does not stack the number when applied twice", () => {
    expect(titleWithCount(titleWithCount("SAPA", 3, true), 5, true)).toBe("(5) SAPA");
  });

  it("removes the number when off or when nothing is waiting", () => {
    expect(titleWithCount("(3) SAPA", 3, false)).toBe("SAPA");
    expect(titleWithCount("(3) SAPA", 0, true)).toBe("SAPA");
  });

  it("shows 99+ for large counts and strips it again", () => {
    expect(titleWithCount("SAPA", 120, true)).toBe("(99+) SAPA");
    expect(titleWithCount("(99+) SAPA", 0, true)).toBe("SAPA");
  });
});

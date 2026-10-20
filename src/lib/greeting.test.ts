import { describe, expect, it } from "vitest";
import { currentPartOfDay, fillGreeting, greetingFor, partOfDay } from "./greeting";

describe("partOfDay", () => {
  it("splits the day at 04:00, 11:00, 15:00 and 18:00", () => {
    expect([3, 4, 10, 11, 14, 15, 17, 18, 23, 0].map(partOfDay)).toEqual(["malam", "pagi", "pagi", "siang", "siang", "sore", "sore", "malam", "malam", "malam"]);
  });

  it("reads the hour in WIB, not the server clock", () => {
    expect(currentPartOfDay(new Date("2026-10-20T21:30:00Z"))).toBe("pagi"); // 04:30 WIB next day
    expect(currentPartOfDay(new Date("2026-10-20T04:00:00Z"))).toBe("siang"); // 11:00 WIB
    expect(currentPartOfDay(new Date("2026-10-20T10:59:00Z"))).toBe("sore"); // 17:59 WIB
    expect(currentPartOfDay(new Date("2026-10-20T11:00:00Z"))).toBe("malam"); // 18:00 WIB
  });
});

describe("greetings", () => {
  it("has a label for each part", () => {
    expect(greetingFor("pagi")).toBe("Selamat pagi");
    expect(greetingFor("malam")).toBe("Selamat malam");
  });

  it("fills the greeting into a mascot line, or leaves it out until the time is known", () => {
    expect(fillGreeting("Halo! {sapaan}. Yuk, masuk dulu ya.", "Selamat sore")).toBe("Halo! Selamat sore. Yuk, masuk dulu ya.");
    expect(fillGreeting("Halo! {sapaan}. Yuk, masuk dulu ya.", null)).toBe("Halo! Yuk, masuk dulu ya.");
    expect(fillGreeting("{sapaan}. Lupa kata sandi? Tenang, kita atur ulang ya.", null)).toBe("Lupa kata sandi? Tenang, kita atur ulang ya.");
    expect(fillGreeting("Sebentar ya", null)).toBe("Sebentar ya");
  });
});

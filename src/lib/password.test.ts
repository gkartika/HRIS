import { describe, it, expect } from "vitest";
import { checkPassword, validatePassword } from "./password";

describe("validatePassword", () => {
  it("accepts 8+ characters with a letter and a digit", () => {
    expect(validatePassword("abcdef12")).toBeNull();
    expect(validatePassword("Kucing2026!")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validatePassword("abc123")).toMatch(/minimal 8/);
  });

  it("rejects letters-only or digits-only", () => {
    expect(validatePassword("abcdefghij")).toMatch(/huruf dan angka/);
    expect(validatePassword("1234567890")).toMatch(/huruf dan angka/);
  });
});

describe("checkPassword", () => {
  it("reports each rule separately for the live checklist", () => {
    expect(checkPassword("abc")).toEqual({ longEnough: false, hasLetterAndDigit: false });
    expect(checkPassword("abcdefgh")).toEqual({ longEnough: true, hasLetterAndDigit: false });
    expect(checkPassword("abcdefg1")).toEqual({ longEnough: true, hasLetterAndDigit: true });
  });
});

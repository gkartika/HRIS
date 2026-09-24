import { describe, it, expect } from "vitest";
import { hashToken, isTokenUsable, TOKEN_TTL_MS } from "./account-tokens";

describe("hashToken", () => {
  it("is deterministic and never returns the raw token", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe("abc");
    expect(hashToken("abc")).toHaveLength(64);
  });
});

describe("isTokenUsable", () => {
  const now = new Date("2026-09-24T10:00:00Z");
  const inFuture = new Date(now.getTime() + 60_000);
  const inPast = new Date(now.getTime() - 60_000);

  it("usable while unused and not expired", () => {
    expect(isTokenUsable({ usedAt: null, expiresAt: inFuture }, now)).toBe(true);
  });

  it("not usable once used or expired", () => {
    expect(isTokenUsable({ usedAt: inPast, expiresAt: inFuture }, now)).toBe(false);
    expect(isTokenUsable({ usedAt: null, expiresAt: inPast }, now)).toBe(false);
  });
});

describe("TOKEN_TTL_MS", () => {
  it("invitations last 7 days, resets 1 day", () => {
    expect(TOKEN_TTL_MS.INVITE).toBe(7 * 24 * 60 * 60 * 1000);
    expect(TOKEN_TTL_MS.RESET).toBe(24 * 60 * 60 * 1000);
  });
});

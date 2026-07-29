import { describe, it, expect } from "vitest";
import {
  computeFulfillmentCounts,
  canRequestAcceptFulfillment,
  nextStatusAfterFulfillment,
  formatRequestNumber,
} from "./recruitment";

describe("computeFulfillmentCounts (DM-23)", () => {
  it("computes remaining and isFull for a partially filled request", () => {
    expect(computeFulfillmentCounts(2, 1)).toEqual({
      filledCount: 1,
      remainingCount: 1,
      isFull: false,
    });
  });

  it("marks isFull once fulfillments reach the requested headcount", () => {
    expect(computeFulfillmentCounts(2, 2)).toEqual({
      filledCount: 2,
      remainingCount: 0,
      isFull: true,
    });
  });

  it("never goes negative if somehow over-fulfilled", () => {
    expect(computeFulfillmentCounts(2, 3).remainingCount).toBe(0);
  });
});

describe("canRequestAcceptFulfillment (WF-13)", () => {
  it("allows Approved, Recruitment In Progress, and Partially Filled", () => {
    expect(canRequestAcceptFulfillment("APPROVED")).toBe(true);
    expect(canRequestAcceptFulfillment("RECRUITMENT_IN_PROGRESS")).toBe(true);
    expect(canRequestAcceptFulfillment("PARTIALLY_FILLED")).toBe(true);
  });

  it("blocks every other status", () => {
    expect(canRequestAcceptFulfillment("DRAFT")).toBe(false);
    expect(canRequestAcceptFulfillment("SUBMITTED")).toBe(false);
    expect(canRequestAcceptFulfillment("UNDER_REVIEW")).toBe(false);
    expect(canRequestAcceptFulfillment("REJECTED")).toBe(false);
    expect(canRequestAcceptFulfillment("RETURNED")).toBe(false);
    expect(canRequestAcceptFulfillment("FILLED")).toBe(false);
    expect(canRequestAcceptFulfillment("CLOSED")).toBe(false);
    expect(canRequestAcceptFulfillment("CANCELLED")).toBe(false);
  });
});

describe("nextStatusAfterFulfillment", () => {
  it("moves to Partially Filled when some but not all seats are filled", () => {
    expect(nextStatusAfterFulfillment(2, 1)).toBe("PARTIALLY_FILLED");
  });

  it("moves to Filled once every seat is filled", () => {
    expect(nextStatusAfterFulfillment(2, 2)).toBe("FILLED");
  });

  it("stays Recruitment In Progress with zero fulfillments", () => {
    expect(nextStatusAfterFulfillment(2, 0)).toBe("RECRUITMENT_IN_PROGRESS");
  });

  it("handles a single-headcount request going straight to Filled", () => {
    expect(nextStatusAfterFulfillment(1, 1)).toBe("FILLED");
  });
});

describe("formatRequestNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(formatRequestNumber(1, 2026)).toBe("REQ-2026-0001");
    expect(formatRequestNumber(42, 2026)).toBe("REQ-2026-0042");
  });
});

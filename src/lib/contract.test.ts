import { describe, it, expect } from "vitest";
import {
  formatContractNumber,
  computeExpiryUrgency,
  canSubmitContractRecommendation,
  canDecideContractRenewal,
  canCreateRenewalDraft,
  canReleaseContract,
  canSignContractStatus,
  canActivateContract,
} from "./contract";

describe("formatContractNumber", () => {
  it("matches the blueprint's own 3-digit example format", () => {
    expect(formatContractNumber("PKWT", 19, 2026)).toBe("PKWT/CBP/2026/019");
    expect(formatContractNumber("PKWTT", 1, 2026)).toBe("PKWTT/CBP/2026/001");
  });
});

describe("computeExpiryUrgency (LIF-10)", () => {
  const endDate = new Date("2026-10-01");

  it("is NONE for a non-Active contract regardless of end date", () => {
    expect(computeExpiryUrgency("DRAFT", endDate, new Date("2026-09-30"))).toBe("NONE");
    expect(computeExpiryUrgency("ENDED", endDate, new Date("2026-09-30"))).toBe("NONE");
  });

  it("is NONE for an indefinite (no end date) contract", () => {
    expect(computeExpiryUrgency("ACTIVE", null, new Date("2026-09-30"))).toBe("NONE");
  });

  it("is NONE more than 90 days out", () => {
    expect(computeExpiryUrgency("ACTIVE", endDate, new Date("2026-06-01"))).toBe("NONE");
  });

  it("steps through the 90/60/30/7 day thresholds", () => {
    expect(computeExpiryUrgency("ACTIVE", endDate, new Date("2026-07-03"))).toBe("DUE_90");
    expect(computeExpiryUrgency("ACTIVE", endDate, new Date("2026-08-02"))).toBe("DUE_60");
    expect(computeExpiryUrgency("ACTIVE", endDate, new Date("2026-09-01"))).toBe("DUE_30");
    expect(computeExpiryUrgency("ACTIVE", endDate, new Date("2026-09-24"))).toBe("DUE_7");
  });

  it("is EXPIRED once the end date has passed", () => {
    expect(computeExpiryUrgency("ACTIVE", endDate, new Date("2026-10-02"))).toBe("EXPIRED");
  });
});

describe("WF-10 status-transition eligibility", () => {
  it("each step only accepts its own predecessor status", () => {
    expect(canSubmitContractRecommendation("REVIEW_REQUESTED")).toBe(true);
    expect(canSubmitContractRecommendation("ACTIVE")).toBe(false);

    expect(canDecideContractRenewal("RECOMMENDATION_SUBMITTED")).toBe(true);
    expect(canDecideContractRenewal("REVIEW_REQUESTED")).toBe(false);

    expect(canCreateRenewalDraft("APPROVED_FOR_RENEWAL")).toBe(true);
    expect(canCreateRenewalDraft("NOT_RENEWED")).toBe(false);

    expect(canReleaseContract("DRAFT")).toBe(true);
    expect(canReleaseContract("SIGNED")).toBe(false);

    expect(canSignContractStatus("RELEASED")).toBe(true);
    expect(canSignContractStatus("DRAFT")).toBe(false);

    expect(canActivateContract("SIGNED")).toBe(true);
    expect(canActivateContract("RELEASED")).toBe(false);
  });
});

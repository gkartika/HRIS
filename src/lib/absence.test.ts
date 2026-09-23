import { describe, it, expect } from "vitest";
import {
  formatAbsenceRequestNumber,
  doDateRangesOverlap,
  absenceDayCount,
  canDecideAbsenceRequestAsFirstApproverStatus,
  canDecideAbsenceRequestAsSecondApproverStatus,
  canDecideAbsenceRequestAsHrAdminStatus,
  canCancelAbsenceRequestStatus,
  canHrOverrideAbsenceRequestStatus,
  remainingEntitlementDays,
} from "./absence";

describe("formatAbsenceRequestNumber", () => {
  it("formats like OFB-YYYY-NNNN but with the ABS prefix", () => {
    expect(formatAbsenceRequestNumber(6, 2026)).toBe("ABS-2026-0006");
  });
});

describe("doDateRangesOverlap", () => {
  it("detects a fully overlapping range", () => {
    expect(
      doDateRangesOverlap(new Date("2026-08-10"), new Date("2026-08-12"), new Date("2026-08-11"), new Date("2026-08-13")),
    ).toBe(true);
  });

  it("detects adjacent (touching) ranges as overlapping", () => {
    expect(
      doDateRangesOverlap(new Date("2026-08-10"), new Date("2026-08-12"), new Date("2026-08-12"), new Date("2026-08-14")),
    ).toBe(true);
  });

  it("does not flag disjoint ranges", () => {
    expect(
      doDateRangesOverlap(new Date("2026-08-10"), new Date("2026-08-12"), new Date("2026-08-15"), new Date("2026-08-16")),
    ).toBe(false);
  });
});

describe("absenceDayCount", () => {
  it("counts inclusively (Mon-Wed is 3 days, not 2)", () => {
    expect(absenceDayCount(new Date("2026-08-10"), new Date("2026-08-12"))).toBe(3);
  });

  it("is 1 for a single-day request", () => {
    expect(absenceDayCount(new Date("2026-08-10"), new Date("2026-08-10"))).toBe(1);
  });
});

describe("status predicates", () => {
  it("only SUBMITTED can be decided by the first approver", () => {
    expect(canDecideAbsenceRequestAsFirstApproverStatus("SUBMITTED")).toBe(true);
    expect(canDecideAbsenceRequestAsFirstApproverStatus("PENDING_HR_ADMIN")).toBe(false);
  });

  it("only PENDING_SECOND_APPROVER can be decided by the second approver", () => {
    expect(canDecideAbsenceRequestAsSecondApproverStatus("PENDING_SECOND_APPROVER")).toBe(true);
    expect(canDecideAbsenceRequestAsSecondApproverStatus("SUBMITTED")).toBe(false);
    expect(canDecideAbsenceRequestAsSecondApproverStatus("PENDING_HR_ADMIN")).toBe(false);
  });

  it("only PENDING_HR_ADMIN can be decided by HR Admin", () => {
    expect(canDecideAbsenceRequestAsHrAdminStatus("PENDING_HR_ADMIN")).toBe(true);
    expect(canDecideAbsenceRequestAsHrAdminStatus("SUBMITTED")).toBe(false);
  });

  it("SUBMITTED, PENDING_SECOND_APPROVER and PENDING_HR_ADMIN can be cancelled, terminal states cannot", () => {
    expect(canCancelAbsenceRequestStatus("SUBMITTED")).toBe(true);
    expect(canCancelAbsenceRequestStatus("PENDING_SECOND_APPROVER")).toBe(true);
    expect(canCancelAbsenceRequestStatus("PENDING_HR_ADMIN")).toBe(true);
    expect(canCancelAbsenceRequestStatus("APPROVED")).toBe(false);
    expect(canCancelAbsenceRequestStatus("REJECTED")).toBe(false);
    expect(canCancelAbsenceRequestStatus("CANCELLED")).toBe(false);
  });

  it("only an already-decided request can be HR-overridden", () => {
    expect(canHrOverrideAbsenceRequestStatus("APPROVED")).toBe(true);
    expect(canHrOverrideAbsenceRequestStatus("REJECTED")).toBe(true);
    expect(canHrOverrideAbsenceRequestStatus("SUBMITTED")).toBe(false);
    expect(canHrOverrideAbsenceRequestStatus("PENDING_HR_ADMIN")).toBe(false);
  });
});

describe("remainingEntitlementDays", () => {
  it("subtracts used days from the annual entitlement", () => {
    expect(remainingEntitlementDays(12, 5)).toBe(7);
  });

  it("never goes negative", () => {
    expect(remainingEntitlementDays(12, 20)).toBe(0);
  });
});

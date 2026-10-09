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
  scheduledDaysInRange,
  findOpenRequestOfType,
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

describe("scheduledDaysInRange (leave counts only working days)", () => {
  const isMonToFri = (_employeeId: string, day: Date) => day.getUTCDay() >= 1 && day.getUTCDay() <= 5;
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("a Friday to Monday leave is 2 working days, not 4", () => {
    // 2026-10-09 is a Friday, 2026-10-12 a Monday
    const days = scheduledDaysInRange(isMonToFri, "e1", d("2026-10-09"), d("2026-10-12"));
    expect(days.map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-10-09", "2026-10-12"]);
  });

  it("skips public holidays inside the range", () => {
    const holiday = d("2026-10-14");
    const isScheduled = (id: string, day: Date) => isMonToFri(id, day) && day.getTime() !== holiday.getTime();
    expect(scheduledDaysInRange(isScheduled, "e1", d("2026-10-13"), d("2026-10-15")).length).toBe(2);
  });

  it("a range that is only a weekend counts as zero", () => {
    expect(scheduledDaysInRange(isMonToFri, "e1", d("2026-10-10"), d("2026-10-11")).length).toBe(0);
  });

  it("a single working day counts as one", () => {
    expect(scheduledDaysInRange(isMonToFri, "e1", d("2026-10-12"), d("2026-10-12")).length).toBe(1);
  });
});

describe("findOpenRequestOfType (one undecided request per type)", () => {
  const cuti = (status: "SUBMITTED" | "PENDING_SECOND_APPROVER" | "PENDING_HR_ADMIN" | "APPROVED" | "REJECTED" | "CANCELLED") => ({
    absenceTypeCode: "CUTI",
    status,
  });

  it("finds an undecided request of the same type at every pending stage", () => {
    expect(findOpenRequestOfType([cuti("SUBMITTED")], "CUTI")).toBeDefined();
    expect(findOpenRequestOfType([cuti("PENDING_SECOND_APPROVER")], "CUTI")).toBeDefined();
    expect(findOpenRequestOfType([cuti("PENDING_HR_ADMIN")], "CUTI")).toBeDefined();
  });

  it("does not block once the request is decided or cancelled", () => {
    expect(findOpenRequestOfType([cuti("APPROVED"), cuti("REJECTED"), cuti("CANCELLED")], "CUTI")).toBeUndefined();
  });

  it("does not block a different type", () => {
    expect(findOpenRequestOfType([cuti("SUBMITTED")], "SAKIT")).toBeUndefined();
  });
});

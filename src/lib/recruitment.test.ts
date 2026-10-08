import { describe, it, expect } from "vitest";
import {
  computeFulfillmentCounts,
  canRequestAcceptFulfillment,
  canCancelRequestStatus,
  nextStatusAfterFulfillment,
  formatRequestNumber,
  initialRecruitmentStatus,
  canCloseRequestStatus,
  canResubmitRequestStatus,
  statusAfterResubmit,
  vacantSeatShortfall,
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
    expect(canRequestAcceptFulfillment("PENDING_DEPT_HEAD")).toBe(false);
    expect(canRequestAcceptFulfillment("SUBMITTED")).toBe(false);
    expect(canRequestAcceptFulfillment("UNDER_REVIEW")).toBe(false);
    expect(canRequestAcceptFulfillment("REJECTED")).toBe(false);
    expect(canRequestAcceptFulfillment("RETURNED")).toBe(false);
    expect(canRequestAcceptFulfillment("FILLED")).toBe(false);
    expect(canRequestAcceptFulfillment("CLOSED")).toBe(false);
    expect(canRequestAcceptFulfillment("CANCELLED")).toBe(false);
  });
});

describe("canCancelRequestStatus (DM-25)", () => {
  it("blocks Filled, Closed, and an already-Cancelled request", () => {
    expect(canCancelRequestStatus("FILLED")).toBe(false);
    expect(canCancelRequestStatus("CLOSED")).toBe(false);
    expect(canCancelRequestStatus("CANCELLED")).toBe(false);
  });

  it("allows every other eligible state, including after approval", () => {
    expect(canCancelRequestStatus("PENDING_DEPT_HEAD")).toBe(true);
    expect(canCancelRequestStatus("SUBMITTED")).toBe(true);
    expect(canCancelRequestStatus("UNDER_REVIEW")).toBe(true);
    expect(canCancelRequestStatus("APPROVED")).toBe(true);
    expect(canCancelRequestStatus("RECRUITMENT_IN_PROGRESS")).toBe(true);
    expect(canCancelRequestStatus("PARTIALLY_FILLED")).toBe(true);
    expect(canCancelRequestStatus("RETURNED")).toBe(true);
    expect(canCancelRequestStatus("REJECTED")).toBe(true);
  });
});

describe("initialRecruitmentStatus (dept-head approval gate)", () => {
  it("starts at Pending Dept Head when the requester holds no level-3B position in this department", () => {
    expect(initialRecruitmentStatus(false)).toBe("PENDING_DEPT_HEAD");
  });

  it("skips straight to Submitted when the requester is already the dept head/manager", () => {
    expect(initialRecruitmentStatus(true)).toBe("SUBMITTED");
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

describe("close (Tutup) and resubmit rules", () => {
  it("only a partly filled request can be closed", () => {
    expect(canCloseRequestStatus("PARTIALLY_FILLED")).toBe(true);
    for (const s of ["APPROVED", "FILLED", "CLOSED", "CANCELLED", "RETURNED", "SUBMITTED"] as const) {
      expect(canCloseRequestStatus(s)).toBe(false);
    }
  });

  it("only a returned request can be resubmitted", () => {
    expect(canResubmitRequestStatus("RETURNED")).toBe(true);
    expect(canResubmitRequestStatus("REJECTED")).toBe(false);
    expect(canResubmitRequestStatus("CANCELLED")).toBe(false);
  });

  it("goes back to the HR Manager when the HR Manager returned it", () => {
    expect(statusAfterResubmit({ returnedByHrManager: true, departmentChanged: false, submitterIsDeptHead: false })).toBe("SUBMITTED");
  });

  it("goes back to the Dept Head when the Dept Head returned it", () => {
    expect(statusAfterResubmit({ returnedByHrManager: false, departmentChanged: false, submitterIsDeptHead: false })).toBe("PENDING_DEPT_HEAD");
  });

  it("restarts from the Dept Head when the department changed", () => {
    expect(statusAfterResubmit({ returnedByHrManager: true, departmentChanged: true, submitterIsDeptHead: false })).toBe("PENDING_DEPT_HEAD");
  });

  it("skips the Dept Head stage when the person resubmitting is the Dept Head", () => {
    expect(statusAfterResubmit({ returnedByHrManager: false, departmentChanged: false, submitterIsDeptHead: true })).toBe("SUBMITTED");
  });

  it("computes how many seats are still missing", () => {
    expect(vacantSeatShortfall(3, 1)).toBe(2);
    expect(vacantSeatShortfall(2, 5)).toBe(0);
  });
});

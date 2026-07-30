// Pure business logic for the simplified Recruitment Request flow
// (DEC-013, DM-21..23, WF-13..14). No Prisma/Next imports — unit testable
// with plain values, same pattern as org-chart.ts's computeStructureWarnings.
import type { RecruitmentRequestStatus } from "@/generated/prisma/enums";

export interface FulfillmentCounts {
  filledCount: number;
  remainingCount: number;
  isFull: boolean;
}

export function computeFulfillmentCounts(
  requestedHeadcount: number,
  fulfillmentsCount: number
): FulfillmentCounts {
  const filledCount = fulfillmentsCount;
  const remainingCount = Math.max(0, requestedHeadcount - filledCount);
  return { filledCount, remainingCount, isFull: remainingCount === 0 };
}

// WF-13: "Only Approved, Recruitment In Progress or Partially Filled
// requests may create Employees."
const FULFILLABLE_STATUSES: RecruitmentRequestStatus[] = [
  "APPROVED",
  "RECRUITMENT_IN_PROGRESS",
  "PARTIALLY_FILLED",
];

export function canRequestAcceptFulfillment(status: RecruitmentRequestStatus): boolean {
  return FULFILLABLE_STATUSES.includes(status);
}

// After a fulfillment is linked, the request status moves along WF-13's
// "Recruitment In Progress > Partially Filled > Filled" chain based purely
// on the derived count — never hand-set by a user action.
export function nextStatusAfterFulfillment(
  requestedHeadcount: number,
  filledCountAfter: number
): RecruitmentRequestStatus {
  if (filledCountAfter >= requestedHeadcount) return "FILLED";
  if (filledCountAfter > 0) return "PARTIALLY_FILLED";
  return "RECRUITMENT_IN_PROGRESS";
}

// Department Manager/Head (Job level 3B) approval gate, ahead of the HR
// Manager, added per direct user request. Skipped when the requester
// already holds that authority themselves in this department — there is no
// one else to approve on their behalf, so the request goes straight to the
// HR Manager's queue instead of getting stuck.
export function initialRecruitmentStatus(requesterIsDeptHead: boolean): RecruitmentRequestStatus {
  return requesterIsDeptHead ? "SUBMITTED" : "PENDING_DEPT_HEAD";
}

export function formatRequestNumber(sequence: number, year: number): string {
  return `REQ-${year}-${String(sequence).padStart(4, "0")}`;
}

// DM-25: "Filled or Closed requests cannot be cancelled through the normal
// action." Also excludes an already-Cancelled request (no double-cancel).
const NOT_CANCELLABLE_STATUSES: RecruitmentRequestStatus[] = ["FILLED", "CLOSED", "CANCELLED"];

export function canCancelRequestStatus(status: RecruitmentRequestStatus): boolean {
  return !NOT_CANCELLABLE_STATUSES.includes(status);
}

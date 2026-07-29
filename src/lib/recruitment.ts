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

export function formatRequestNumber(sequence: number, year: number): string {
  return `REQ-${year}-${String(sequence).padStart(4, "0")}`;
}

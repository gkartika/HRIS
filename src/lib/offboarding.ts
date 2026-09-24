// Pure business logic for Offboarding (LIF-06/07/12, WF-10, GA-05,
// DSH-08/09/14). No Prisma/Next imports — unit testable with plain values,
// same pattern as contract-renewal.ts/evaluation.ts/movement.ts.
import type { OffboardingCaseStatus } from "@/generated/prisma/enums";

export function formatOffboardingCaseNumber(sequence: number, year: number): string {
  return `OFB-${year}-${String(sequence).padStart(4, "0")}`;
}

// HR Admin alone opens an offboarding case (per direct user request) — there
// is no Dept Head / HR Manager approval stage, so every case starts here.
export const INITIAL_OFFBOARDING_CASE_STATUS: OffboardingCaseStatus = "PENDING_CLEARANCE";

export function canExecuteExitClearanceStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_CLEARANCE";
}

export function canCancelOffboardingCaseStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_CLEARANCE";
}

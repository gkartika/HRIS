// Pure business logic for Offboarding (LIF-06/07/12, WF-10, GA-05,
// DSH-08/09/14). No Prisma/Next imports — unit testable with plain values,
// same pattern as contract-renewal.ts/evaluation.ts/movement.ts.
import type { OffboardingReason, OffboardingCaseStatus } from "@/generated/prisma/enums";

export function formatOffboardingCaseNumber(sequence: number, year: number): string {
  return `OFB-${year}-${String(sequence).padStart(4, "0")}`;
}

// LIF-06: "manager input when required" is captured as data at report time
// (managerNote), not a separate stored stage. Per direct user request, a
// RESIGNATION case now needs the same Dept Head (3B, employee's own
// department) -> HR Manager two-stage chain already used by Recruitment/
// Movement/Contract Renewal, so it starts at PENDING_DEPT_HEAD. LIF-12: a
// CONTRACT_NON_RENEWAL handoff's Dept-Head/HR-Manager rationale was already
// recorded on the source Contract Renewal Case's own combined decision —
// that case starts directly at PENDING_CLEARANCE, skipping both stages a
// second time on the same outcome.
export function initialOffboardingCaseStatus(reason: OffboardingReason): OffboardingCaseStatus {
  if (reason === "CONTRACT_NON_RENEWAL") return "PENDING_CLEARANCE";
  return "PENDING_DEPT_HEAD";
}

export function canDecideOffboardingCaseAsDeptHeadStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_DEPT_HEAD";
}

export function canDecideOffboardingCaseStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_HR_MANAGER";
}

export function canExecuteExitClearanceStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_CLEARANCE";
}

export function canCancelOffboardingCaseStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_DEPT_HEAD" || status === "PENDING_HR_MANAGER" || status === "PENDING_CLEARANCE";
}

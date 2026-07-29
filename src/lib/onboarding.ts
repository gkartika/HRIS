// Pure business logic for the Onboarding Case flow (LIF-03, Data Fields
// Blueprint "12 Onboarding"). No Prisma/Next imports — unit testable with
// plain values, same pattern as recruitment.ts/movement.ts.
import type { OnboardingOverallStatus } from "@/generated/prisma/enums";

export function formatOnboardingCaseNumber(sequence: number, year: number): string {
  return `ONB-${year}-${String(sequence).padStart(4, "0")}`;
}

export interface OnboardingCompletionInput {
  contractComplete: boolean;
  mandatoryMaterialComplete: boolean;
  assetsComplete: boolean;
  plannedStartDate: Date;
  mandatoryMaterialDueDate: Date | null;
}

/**
 * Blueprint's overall_status is "Calculated dropdown" — never stored
 * directly. Complete once all three admin-owned flags are true; Not
 * Started before the planned start date with nothing done yet; Overdue if
 * the mandatory-material due date has passed without that flag being set;
 * otherwise In Progress.
 */
export function computeOnboardingStatus(
  input: OnboardingCompletionInput,
  now: Date = new Date()
): OnboardingOverallStatus {
  const { contractComplete, mandatoryMaterialComplete, assetsComplete, plannedStartDate, mandatoryMaterialDueDate } =
    input;

  if (contractComplete && mandatoryMaterialComplete && assetsComplete) return "COMPLETE";
  if (mandatoryMaterialDueDate && !mandatoryMaterialComplete && now > mandatoryMaterialDueDate) return "OVERDUE";
  if (now < plannedStartDate && !contractComplete && !mandatoryMaterialComplete && !assetsComplete) {
    return "NOT_STARTED";
  }
  return "IN_PROGRESS";
}

export function isOnboardingFullyComplete(
  contractComplete: boolean,
  mandatoryMaterialComplete: boolean,
  assetsComplete: boolean
): boolean {
  return contractComplete && mandatoryMaterialComplete && assetsComplete;
}

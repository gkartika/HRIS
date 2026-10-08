import { prisma } from "@/lib/db";
import { shouldApplyOnboardingTrainingOnPlacement } from "@/lib/onboarding";
import { applyOnboardingMandatoryTrainingForEmployee } from "@/lib/mandatory-training";

// A new hire created without a position gets only the company-wide onboarding
// courses at creation (position, job and department rules cannot resolve yet).
// When they are FIRST placed, the rest are assigned here (decided 2026-10-08).
// Does nothing for anyone who already had a primary placement or who has no
// open onboarding case, so imported staff are never given onboarding courses.
// Safe to call twice: the apply function never duplicates an assignment.
export async function applyOnboardingTrainingIfFirstPlacement(
  employeeId: string,
  hadPrimaryPlacementBefore: boolean,
  actorAccountId: string
): Promise<number> {
  if (hadPrimaryPlacementBefore) return 0;
  const onboardingCase = await prisma.onboardingCase.findUnique({
    where: { employeeId },
    select: { cancelledAt: true, completedAt: true },
  });
  const hasOpenOnboardingCase = !!onboardingCase && !onboardingCase.cancelledAt && !onboardingCase.completedAt;
  if (!shouldApplyOnboardingTrainingOnPlacement({ hadPrimaryPlacementBefore, hasOpenOnboardingCase })) return 0;
  const { assignedCount } = await applyOnboardingMandatoryTrainingForEmployee(employeeId, actorAccountId);
  return assignedCount;
}

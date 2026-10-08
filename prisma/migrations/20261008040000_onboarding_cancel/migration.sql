-- Additive only: a "cancelled" onboarding status and three optional columns on OnboardingCase.
-- AlterEnum
ALTER TYPE "OnboardingOverallStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "OnboardingCase" ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledByAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

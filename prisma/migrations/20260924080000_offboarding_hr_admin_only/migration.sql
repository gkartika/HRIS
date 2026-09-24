-- Offboarding is now opened by HR Admin alone: no Dept Head / HR Manager stage.
UPDATE "OffboardingCase" SET "status" = 'PENDING_CLEARANCE' WHERE "status" IN ('PENDING_DEPT_HEAD', 'PENDING_HR_MANAGER');

ALTER TYPE "OffboardingCaseStatus" RENAME TO "OffboardingCaseStatus_old";
CREATE TYPE "OffboardingCaseStatus" AS ENUM ('PENDING_CLEARANCE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "OffboardingCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OffboardingCase" ALTER COLUMN "status" TYPE "OffboardingCaseStatus" USING ("status"::text::"OffboardingCaseStatus");
ALTER TABLE "OffboardingCase" ALTER COLUMN "status" SET DEFAULT 'PENDING_CLEARANCE';
DROP TYPE "OffboardingCaseStatus_old";

ALTER TABLE "OffboardingCase"
  DROP COLUMN "deptHeadDecisionAt",
  DROP COLUMN "deptHeadDecisionByAccountId",
  DROP COLUMN "deptHeadDecisionPositionId",
  DROP COLUMN "deptHeadNote",
  DROP COLUMN "hrManagerDecisionAt",
  DROP COLUMN "hrManagerDecisionByAccountId",
  DROP COLUMN "hrManagerDecisionPositionId",
  DROP COLUMN "hrManagerNote";

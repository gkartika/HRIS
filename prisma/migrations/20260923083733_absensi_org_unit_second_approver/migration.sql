-- AlterEnum
ALTER TYPE "AbsenceStatus" ADD VALUE 'PENDING_SECOND_APPROVER';

-- DropForeignKey
ALTER TABLE "AbsenceApproverConfig" DROP CONSTRAINT "AbsenceApproverConfig_departmentId_fkey";

-- DropIndex
DROP INDEX "AbsenceApproverConfig_departmentId_key";

-- RenameColumn (hand-edited from the generated DROP+ADD to preserve the
-- existing row's value — see docs/DECISIONS.md's non-interactive migration
-- workaround note)
ALTER TABLE "AbsenceApproverConfig" RENAME COLUMN "departmentId" TO "orgUnitId";

-- AlterTable
ALTER TABLE "AbsenceRequest" ADD COLUMN     "secondApproverPositionId" TEXT,
ADD COLUMN     "secondDecisionAt" TIMESTAMP(3),
ADD COLUMN     "secondDecisionByAccountId" TEXT,
ADD COLUMN     "secondDecisionNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceApproverConfig_orgUnitId_key" ON "AbsenceApproverConfig"("orgUnitId");

-- AddForeignKey
ALTER TABLE "AbsenceApproverConfig" ADD CONSTRAINT "AbsenceApproverConfig_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_secondApproverPositionId_fkey" FOREIGN KEY ("secondApproverPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_secondDecisionByAccountId_fkey" FOREIGN KEY ("secondDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

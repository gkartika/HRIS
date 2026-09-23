-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "defaultOrgUnitId" TEXT,
ADD COLUMN     "defaultPositionType" "PositionType";

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_defaultOrgUnitId_fkey" FOREIGN KEY ("defaultOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "MovementRequest" ADD COLUMN     "recruitmentRequestId" TEXT;

-- CreateIndex
CREATE INDEX "MovementRequest_recruitmentRequestId_idx" ON "MovementRequest"("recruitmentRequestId");

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_recruitmentRequestId_fkey" FOREIGN KEY ("recruitmentRequestId") REFERENCES "RecruitmentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;


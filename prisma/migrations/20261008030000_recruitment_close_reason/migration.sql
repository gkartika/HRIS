-- Additive only: three nullable columns on RecruitmentRequest for "Tutup" (close a partly filled request).
-- AlterTable
ALTER TABLE "RecruitmentRequest" ADD COLUMN "closeReason" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "closedByAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_closedByAccountId_fkey" FOREIGN KEY ("closedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

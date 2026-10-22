-- A second upload on the applicant, and a fixed "where did this come from" on moves and filled positions.
-- Additive only. Written by hand: the shared database also holds the BUILD branch's assessment tables,
-- so a generated diff would propose dropping them.

-- CreateEnum
CREATE TYPE "FulfillmentSource" AS ENUM ('RECRUITMENT_EXTERNAL', 'RECRUITMENT_INTERNAL', 'MUTASI');

-- CreateEnum
CREATE TYPE "MovementOrigin" AS ENUM ('MUTASI', 'REKRUTMEN_INTERNAL');

-- AlterTable
ALTER TABLE "RecruitmentCandidate" ADD COLUMN "supportingFileId" TEXT;

-- AlterTable
ALTER TABLE "RecruitmentRequestFulfillment" ADD COLUMN "source" "FulfillmentSource" NOT NULL DEFAULT 'RECRUITMENT_EXTERNAL';

-- AlterTable
ALTER TABLE "MovementRequest" ADD COLUMN "origin" "MovementOrigin" NOT NULL DEFAULT 'MUTASI';

-- AddForeignKey
ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_supportingFileId_fkey" FOREIGN KEY ("supportingFileId") REFERENCES "RecruitmentFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing rows: a move linked to an applicant came from internal recruitment, everything else is a Mutasi.
UPDATE "MovementRequest" m SET "origin" = 'REKRUTMEN_INTERNAL'
  WHERE EXISTS (SELECT 1 FROM "RecruitmentCandidate" c WHERE c."movementRequestId" = m."id");

-- Existing filled positions: an internal applicant, or a move with no applicant (Mutasi); the rest stay external.
UPDATE "RecruitmentRequestFulfillment" f SET "source" = 'RECRUITMENT_INTERNAL'
  WHERE EXISTS (SELECT 1 FROM "RecruitmentCandidate" c WHERE c."requestId" = f."recruitmentRequestId" AND c."employeeId" = f."employeeId" AND c."source" = 'INTERNAL');
UPDATE "RecruitmentRequestFulfillment" f SET "source" = 'MUTASI'
  WHERE f."source" = 'RECRUITMENT_EXTERNAL'
    AND EXISTS (SELECT 1 FROM "MovementRequest" m WHERE m."recruitmentRequestId" = f."recruitmentRequestId" AND m."employeeId" = f."employeeId");

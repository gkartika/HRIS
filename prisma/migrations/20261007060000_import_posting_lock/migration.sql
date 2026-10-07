-- AlterEnum
ALTER TYPE "ImportStatus" ADD VALUE 'POSTING';

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN "postingStartedAt" TIMESTAMP(3);

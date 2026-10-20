-- AlterTable
ALTER TABLE "RecruitmentRequest" ADD COLUMN     "testTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "testsCustomized" BOOLEAN NOT NULL DEFAULT false;

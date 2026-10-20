-- AlterTable
ALTER TABLE "RecruitmentTestType" ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;

-- Logika Dasar: its correct answers sit almost always at C, so each applicant gets the options in their own order.
UPDATE "RecruitmentTestType" SET "shuffleOptions" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'rtt_logika_dasar';

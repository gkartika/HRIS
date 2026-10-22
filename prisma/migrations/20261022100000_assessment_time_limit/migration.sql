-- AlterTable: the applicant time limit of Tes Situasi Kerja is set in the app (default 30 minutes, as before).
ALTER TABLE "RecruitmentAssessmentVersion" ADD COLUMN "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable: each attempt keeps the limit it started with.
ALTER TABLE "RecruitmentAssessmentSubmission" ADD COLUMN "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30;

-- An applicant who withdraws or does not show up gets its own end status (no waiting period, not counted as a
-- rejection), and HR can mark that an applicant closed by a closed, cancelled or filled request was told.
-- Additive only: one new enum value and one nullable column.
ALTER TYPE "RecruitmentCandidateStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TABLE "RecruitmentCandidate" ADD COLUMN "closureNotifiedAt" TIMESTAMP(3);

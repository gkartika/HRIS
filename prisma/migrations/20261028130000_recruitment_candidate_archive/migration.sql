-- When an applicant who left without being hired is deleted (clean-up), one row WITHOUT name, email, phone or CV is kept
-- so the recruitment dashboard numbers do not change. Additive: one new table.
CREATE TABLE "RecruitmentCandidateArchive" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "source" "RecruitmentCandidateSource" NOT NULL,
    "status" "RecruitmentCandidateStatus" NOT NULL,
    "stage" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "passedAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentCandidateArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecruitmentCandidateArchive_requestId_idx" ON "RecruitmentCandidateArchive"("requestId");
CREATE INDEX "RecruitmentCandidateArchive_appliedAt_idx" ON "RecruitmentCandidateArchive"("appliedAt");
CREATE INDEX "RecruitmentCandidateArchive_closedAt_idx" ON "RecruitmentCandidateArchive"("closedAt");

ALTER TABLE "RecruitmentCandidateArchive" ADD CONSTRAINT "RecruitmentCandidateArchive_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chosen by the owner (28 Oct 2026): applicant data is kept 180 days. Only a setting still at the old default of 30 moves.
ALTER TABLE "RecruitmentSetting" ALTER COLUMN "retentionDays" SET DEFAULT 180;
UPDATE "RecruitmentSetting" SET "retentionDays" = 180 WHERE "retentionDays" = 30;

-- Interview cancelled because the applicant will not come. Additive only: one enum and five empty columns on RecruitmentInterview.
CREATE TYPE "InterviewCancelKind" AS ENUM ('WITHDREW', 'NO_SHOW');

ALTER TABLE "RecruitmentInterview"
    ADD COLUMN "cancelledAt" TIMESTAMP(3),
    ADD COLUMN "cancelledByAccountId" TEXT,
    ADD COLUMN "cancelKind" "InterviewCancelKind",
    ADD COLUMN "cancelReason" TEXT,
    ADD COLUMN "cancelNote" TEXT;

-- CreateEnum
CREATE TYPE "RecruitmentRequestEventKind" AS ENUM ('HELD', 'RESUMED', 'HEADCOUNT_REDUCED', 'JOB_SET', 'JOB_CHANGED');

-- AlterTable
ALTER TABLE "RecruitmentRequest" ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "heldReason" TEXT,
ADD COLUMN     "requestedJobText" TEXT,
ALTER COLUMN "requestedJobLevel" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RecruitmentRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "RecruitmentRequestEventKind" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "note" TEXT,
    "actorAccountId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruitmentRequestEvent_requestId_createdAt_idx" ON "RecruitmentRequestEvent"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "RecruitmentRequestEvent" ADD CONSTRAINT "RecruitmentRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequestEvent" ADD CONSTRAINT "RecruitmentRequestEvent_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Requests filed before this change: the Jabatan text is the standard Jabatan's title
UPDATE "RecruitmentRequest" r SET "requestedJobText" = j."jobTitle" FROM "Job" j WHERE r."jobId" = j."id" AND r."requestedJobText" IS NULL;

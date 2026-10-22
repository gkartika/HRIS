-- CreateEnum
CREATE TYPE "AssessmentRubricStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentSubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "AssessmentScreeningStatus" AS ENUM ('INCOMPLETE', 'NO_AGGREGATE_CONCERN', 'INTERVIEW_ATTENTION', 'PRIORITY_REVIEW');

-- CreateTable
CREATE TABLE "RecruitmentAssessmentVersion" (
    "id" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "instructions" TEXT[],
    "closingText" TEXT NOT NULL,
    "estimatedMinMin" INTEGER NOT NULL,
    "estimatedMinMax" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentAssessmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentQuestion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "questionNo" INTEGER NOT NULL,
    "questionCode" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,

    CONSTRAINT "RecruitmentAssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecruitmentAssessmentOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentRubric" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "rubricLabel" TEXT NOT NULL,
    "status" "AssessmentRubricStatus" NOT NULL DEFAULT 'DRAFT',
    "riskSignalLegend" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "sourceNote" TEXT,
    "sourceSha256" TEXT,
    "basedOnRubricId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedByAccountId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedByAccountId" TEXT,
    "decisionNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByAccountId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedByAccountId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentAssessmentRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentInterpretation" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "questionNo" INTEGER NOT NULL,
    "optionKey" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "primaryDimension" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "riskSignal" INTEGER NOT NULL,
    "requiresControlReview" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentAssessmentInterpretation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentRubricEvent" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorAccountId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentAssessmentRubricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentSubmission" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "status" "AssessmentSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "scoredAt" TIMESTAMP(3),
    "totalScore" INTEGER,
    "screeningStatus" "AssessmentScreeningStatus",
    "engineVersion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentAssessmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAssessmentResultItem" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionNo" INTEGER NOT NULL,
    "rubricId" TEXT NOT NULL,
    "interpretationId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "primaryDimension" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "riskSignal" INTEGER NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "requiresControlReview" BOOLEAN NOT NULL,

    CONSTRAINT "RecruitmentAssessmentResultItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentVersion_versionLabel_key" ON "RecruitmentAssessmentVersion"("versionLabel");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentQuestion_versionId_questionNo_key" ON "RecruitmentAssessmentQuestion"("versionId", "questionNo");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentOption_questionId_optionKey_key" ON "RecruitmentAssessmentOption"("questionId", "optionKey");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentRubric_versionId_status_idx" ON "RecruitmentAssessmentRubric"("versionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentRubric_versionId_rubricLabel_key" ON "RecruitmentAssessmentRubric"("versionId", "rubricLabel");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentInterpretation_rubricId_questionNo_idx" ON "RecruitmentAssessmentInterpretation"("rubricId", "questionNo");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentInterpretation_rubricId_optionId_key" ON "RecruitmentAssessmentInterpretation"("rubricId", "optionId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentRubricEvent_rubricId_createdAt_idx" ON "RecruitmentAssessmentRubricEvent"("rubricId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentSubmission_candidateId_key" ON "RecruitmentAssessmentSubmission"("candidateId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentSubmission_status_idx" ON "RecruitmentAssessmentSubmission"("status");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentSubmission_versionId_idx" ON "RecruitmentAssessmentSubmission"("versionId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentSubmission_rubricId_idx" ON "RecruitmentAssessmentSubmission"("rubricId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentAnswer_questionId_idx" ON "RecruitmentAssessmentAnswer"("questionId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentAnswer_optionId_idx" ON "RecruitmentAssessmentAnswer"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentAnswer_submissionId_questionId_key" ON "RecruitmentAssessmentAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentResultItem_rubricId_idx" ON "RecruitmentAssessmentResultItem"("rubricId");

-- CreateIndex
CREATE INDEX "RecruitmentAssessmentResultItem_interpretationId_idx" ON "RecruitmentAssessmentResultItem"("interpretationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentAssessmentResultItem_submissionId_questionNo_key" ON "RecruitmentAssessmentResultItem"("submissionId", "questionNo");

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentQuestion" ADD CONSTRAINT "RecruitmentAssessmentQuestion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecruitmentAssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentOption" ADD CONSTRAINT "RecruitmentAssessmentOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RecruitmentAssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentRubric" ADD CONSTRAINT "RecruitmentAssessmentRubric_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecruitmentAssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentInterpretation" ADD CONSTRAINT "RecruitmentAssessmentInterpretation_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "RecruitmentAssessmentRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentInterpretation" ADD CONSTRAINT "RecruitmentAssessmentInterpretation_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "RecruitmentAssessmentOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentRubricEvent" ADD CONSTRAINT "RecruitmentAssessmentRubricEvent_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "RecruitmentAssessmentRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentSubmission" ADD CONSTRAINT "RecruitmentAssessmentSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentSubmission" ADD CONSTRAINT "RecruitmentAssessmentSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecruitmentAssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentSubmission" ADD CONSTRAINT "RecruitmentAssessmentSubmission_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "RecruitmentAssessmentRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentAnswer" ADD CONSTRAINT "RecruitmentAssessmentAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "RecruitmentAssessmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentAnswer" ADD CONSTRAINT "RecruitmentAssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RecruitmentAssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentAnswer" ADD CONSTRAINT "RecruitmentAssessmentAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "RecruitmentAssessmentOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentResultItem" ADD CONSTRAINT "RecruitmentAssessmentResultItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "RecruitmentAssessmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentResultItem" ADD CONSTRAINT "RecruitmentAssessmentResultItem_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "RecruitmentAssessmentRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAssessmentResultItem" ADD CONSTRAINT "RecruitmentAssessmentResultItem_interpretationId_fkey" FOREIGN KEY ("interpretationId") REFERENCES "RecruitmentAssessmentInterpretation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Only one rubric of an assessment version may be ACTIVE at a time (a partial index Prisma cannot express).
CREATE UNIQUE INDEX "RecruitmentAssessmentRubric_one_active_per_version" ON "RecruitmentAssessmentRubric"("versionId") WHERE "status" = 'ACTIVE';

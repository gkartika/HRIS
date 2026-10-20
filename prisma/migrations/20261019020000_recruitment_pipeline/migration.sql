-- CreateEnum
CREATE TYPE "RecruitmentOpenFor" AS ENUM ('NONE', 'EXTERNAL', 'INTERNAL', 'BOTH');

-- CreateEnum
CREATE TYPE "RecruitmentCandidateSource" AS ENUM ('EXTERNAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "RecruitmentCandidateStatus" AS ENUM ('TESTING', 'AWAITING_REVIEW', 'TEST_PASSED', 'TEST_FAILED', 'INTERVIEWING', 'OFFERING', 'MOVEMENT', 'HIRED', 'REJECTED', 'OFFER_DECLINED', 'NOT_SELECTED');

-- CreateEnum
CREATE TYPE "RecruitmentTestForm" AS ENUM ('SCALE', 'MULTIPLE_CHOICE', 'ESSAY');

-- CreateEnum
CREATE TYPE "RecruitmentCandidateTestStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "RecruitmentInterviewDecision" AS ENUM ('ACCEPTED', 'CONSIDERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecruitmentInterviewMode" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateEnum
CREATE TYPE "RecruitmentOfferResponse" AS ENUM ('ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "RecruitmentRequest" ADD COLUMN     "accessCode" TEXT,
ADD COLUMN     "openFor" "RecruitmentOpenFor" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "RecruitmentTestType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "form" "RecruitmentTestForm" NOT NULL,
    "passScore" INTEGER NOT NULL DEFAULT 70,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 15,
    "isGate" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentTestType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentTestQuestion" (
    "id" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER,
    "reverseScored" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentTestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentJobTest" (
    "jobId" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,

    CONSTRAINT "RecruitmentJobTest_pkey" PRIMARY KEY ("jobId","testTypeId")
);

-- CreateTable
CREATE TABLE "RecruitmentInterviewAspect" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecruitmentInterviewAspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultInterviewers" INTEGER NOT NULL DEFAULT 1,
    "maxInterviewers" INTEGER NOT NULL DEFAULT 4,
    "retakeDays" INTEGER NOT NULL DEFAULT 30,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "invitationEmailTemplate" TEXT NOT NULL DEFAULT 'Yth. {nama}, kami mengundang Anda interview untuk posisi {posisi} pada {tanggal} pukul {jam} di {lokasi}. Mohon konfirmasi kehadiran dengan membalas pesan ini.',
    "invitationWaTemplate" TEXT NOT NULL DEFAULT 'Halo {nama}, ini HR PT CBP. Interview untuk posisi {posisi}: {tanggal}, pukul {jam}, di {lokasi}. Mohon balas pesan ini untuk konfirmasi.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentFile" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentCandidate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "source" "RecruitmentCandidateSource" NOT NULL,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobileNumber" TEXT,
    "cvFileId" TEXT,
    "status" "RecruitmentCandidateStatus" NOT NULL DEFAULT 'TESTING',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenHash" TEXT,
    "interviewDecision" "RecruitmentInterviewDecision",
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedByAccountId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "movementRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentCandidateTest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RecruitmentCandidateTestStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "scorePercent" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "passScoreSnapshot" INTEGER,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByEmployeeId" TEXT,

    CONSTRAINT "RecruitmentCandidateTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentCandidateAnswer" (
    "id" TEXT NOT NULL,
    "candidateTestId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerIndex" INTEGER,
    "answerText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentCandidateAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentTestReviewer" (
    "id" TEXT NOT NULL,
    "candidateTestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grantedByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentTestReviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentInterview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "mode" "RecruitmentInterviewMode" NOT NULL,
    "location" TEXT NOT NULL,
    "invitationSentAt" TIMESTAMP(3),
    "hrAttendanceNote" TEXT,
    "hrDocumentsNote" TEXT,
    "hrProcessNote" TEXT,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentInterviewer" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "recommendation" "RecruitmentInterviewDecision",
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentInterviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentInterviewScore" (
    "id" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "aspectId" TEXT NOT NULL,
    "aspectLabel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "RecruitmentInterviewScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentOffer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "companySignature" TEXT NOT NULL,
    "companySignedAt" TIMESTAMP(3) NOT NULL,
    "companySignedByAccountId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "response" "RecruitmentOfferResponse",
    "respondedAt" TIMESTAMP(3),
    "candidateSignature" TEXT,
    "recordedByHr" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentTestType_name_key" ON "RecruitmentTestType"("name");

-- CreateIndex
CREATE INDEX "RecruitmentTestQuestion_testTypeId_active_idx" ON "RecruitmentTestQuestion"("testTypeId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentFile_storageKey_key" ON "RecruitmentFile"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentCandidate_tokenHash_key" ON "RecruitmentCandidate"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentCandidate_movementRequestId_key" ON "RecruitmentCandidate"("movementRequestId");

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_requestId_status_idx" ON "RecruitmentCandidate"("requestId", "status");

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_email_idx" ON "RecruitmentCandidate"("email");

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_status_closedAt_idx" ON "RecruitmentCandidate"("status", "closedAt");

-- CreateIndex
CREATE INDEX "RecruitmentCandidate_employeeId_idx" ON "RecruitmentCandidate"("employeeId");

-- CreateIndex
CREATE INDEX "RecruitmentCandidateTest_status_deadlineAt_idx" ON "RecruitmentCandidateTest"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentCandidateTest_candidateId_testTypeId_key" ON "RecruitmentCandidateTest"("candidateId", "testTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentCandidateAnswer_candidateTestId_questionId_key" ON "RecruitmentCandidateAnswer"("candidateTestId", "questionId");

-- CreateIndex
CREATE INDEX "RecruitmentTestReviewer_employeeId_idx" ON "RecruitmentTestReviewer"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentTestReviewer_candidateTestId_employeeId_key" ON "RecruitmentTestReviewer"("candidateTestId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentInterview_candidateId_key" ON "RecruitmentInterview"("candidateId");

-- CreateIndex
CREATE INDEX "RecruitmentInterviewer_employeeId_submittedAt_idx" ON "RecruitmentInterviewer"("employeeId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentInterviewer_interviewId_employeeId_key" ON "RecruitmentInterviewer"("interviewId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentInterviewScore_interviewerId_aspectId_key" ON "RecruitmentInterviewScore"("interviewerId", "aspectId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentOffer_candidateId_key" ON "RecruitmentOffer"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentOffer_tokenHash_key" ON "RecruitmentOffer"("tokenHash");

-- AddForeignKey
ALTER TABLE "RecruitmentTestQuestion" ADD CONSTRAINT "RecruitmentTestQuestion_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "RecruitmentTestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentJobTest" ADD CONSTRAINT "RecruitmentJobTest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentJobTest" ADD CONSTRAINT "RecruitmentJobTest_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "RecruitmentTestType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_cvFileId_fkey" FOREIGN KEY ("cvFileId") REFERENCES "RecruitmentFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_movementRequestId_fkey" FOREIGN KEY ("movementRequestId") REFERENCES "MovementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidateTest" ADD CONSTRAINT "RecruitmentCandidateTest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidateTest" ADD CONSTRAINT "RecruitmentCandidateTest_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "RecruitmentTestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidateAnswer" ADD CONSTRAINT "RecruitmentCandidateAnswer_candidateTestId_fkey" FOREIGN KEY ("candidateTestId") REFERENCES "RecruitmentCandidateTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentCandidateAnswer" ADD CONSTRAINT "RecruitmentCandidateAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RecruitmentTestQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentTestReviewer" ADD CONSTRAINT "RecruitmentTestReviewer_candidateTestId_fkey" FOREIGN KEY ("candidateTestId") REFERENCES "RecruitmentCandidateTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentTestReviewer" ADD CONSTRAINT "RecruitmentTestReviewer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentInterview" ADD CONSTRAINT "RecruitmentInterview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentInterviewer" ADD CONSTRAINT "RecruitmentInterviewer_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "RecruitmentInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentInterviewer" ADD CONSTRAINT "RecruitmentInterviewer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentInterviewScore" ADD CONSTRAINT "RecruitmentInterviewScore_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "RecruitmentInterviewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentInterviewScore" ADD CONSTRAINT "RecruitmentInterviewScore_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "RecruitmentInterviewAspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RecruitmentFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Starting content, all editable in Pengaturan Rekrutmen. The three test kinds from the
-- workflow draft (question banks start empty: HR Admin writes the questions in the app) and
-- five example interview aspects.
INSERT INTO "RecruitmentTestType" ("id", "name", "description", "form", "passScore", "timeLimitMinutes", "isGate", "sortOrder", "active", "updatedAt") VALUES
  ('rtt_cultural_fit', 'Cultural Fit', 'Wajib untuk semua posisi, dikerjakan pertama.', 'SCALE', 70, 10, true, 1, true, CURRENT_TIMESTAMP),
  ('rtt_ketelitian', 'Ketelitian', 'Pilihan ganda, dinilai otomatis.', 'MULTIPLE_CHOICE', 70, 15, false, 2, true, CURRENT_TIMESTAMP),
  ('rtt_studi_kasus', 'Studi Kasus', 'Esai, dibaca dan dinilai reviewer yang dipilih HR Admin.', 'ESSAY', 70, 30, false, 3, true, CURRENT_TIMESTAMP);

INSERT INTO "RecruitmentInterviewAspect" ("id", "label", "sortOrder", "active") VALUES
  ('ria_sikap', 'Sikap dan etika', 1, true),
  ('ria_komunikasi', 'Komunikasi', 2, true),
  ('ria_teknis', 'Pengetahuan teknis', 3, true),
  ('ria_motivasi', 'Motivasi', 4, true),
  ('ria_budaya', 'Kesesuaian budaya', 5, true);

INSERT INTO "RecruitmentSetting" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);

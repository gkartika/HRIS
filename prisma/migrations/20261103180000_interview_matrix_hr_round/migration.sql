-- Interview matrix (scores 2, 4, 6, 8, 10) and the HR round by Admin Rekrutmen.
-- Additive: new enum, new columns with defaults, new tables, one new enum value. The only change to existing rows
-- is switching the five old interview aspects off (they stay, so old scores keep their labels); no row is deleted.

-- Who scores an aspect, and whether it may be left empty
CREATE TYPE "RecruitmentAspectAudience" AS ENUM ('USER', 'HR');

ALTER TABLE "RecruitmentInterviewAspect"
  ADD COLUMN "audience" "RecruitmentAspectAudience" NOT NULL DEFAULT 'USER',
  ADD COLUMN "optional" BOOLEAN NOT NULL DEFAULT false;

-- Highest possible score of the matrix a score was given on (older interviews stay on 5)
ALTER TABLE "RecruitmentInterviewScore" ADD COLUMN "maxScore" INTEGER NOT NULL DEFAULT 5;

-- The user interview cancelled because HR turned the applicant down
ALTER TYPE "InterviewCancelKind" ADD VALUE 'HR_REJECTED';

-- The HR round
CREATE TABLE "RecruitmentHrInterview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "mode" "RecruitmentInterviewMode" NOT NULL,
    "location" TEXT NOT NULL,
    "invitationSentAt" TIMESTAMP(3),
    "createdByAccountId" TEXT NOT NULL,
    "scoredByAccountId" TEXT,
    "recommendation" "RecruitmentInterviewDecision",
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancelKind" "InterviewCancelKind",
    "cancelReason" TEXT,
    "cancelNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentHrInterview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruitmentHrScore" (
    "id" TEXT NOT NULL,
    "hrInterviewId" TEXT NOT NULL,
    "aspectId" TEXT NOT NULL,
    "aspectLabel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "RecruitmentHrScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecruitmentHrInterview_candidateId_key" ON "RecruitmentHrInterview"("candidateId");
CREATE UNIQUE INDEX "RecruitmentHrScore_hrInterviewId_aspectId_key" ON "RecruitmentHrScore"("hrInterviewId", "aspectId");

ALTER TABLE "RecruitmentHrInterview" ADD CONSTRAINT "RecruitmentHrInterview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentHrScore" ADD CONSTRAINT "RecruitmentHrScore_hrInterviewId_fkey" FOREIGN KEY ("hrInterviewId") REFERENCES "RecruitmentHrInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentHrScore" ADD CONSTRAINT "RecruitmentHrScore_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "RecruitmentInterviewAspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The matrix in use. The five old aspects are switched off, not deleted, so the scores already given keep their names.
UPDATE "RecruitmentInterviewAspect" SET "active" = false WHERE "audience" = 'USER' AND "id" IN ('ria_sikap', 'ria_komunikasi', 'ria_teknis', 'ria_motivasi', 'ria_budaya');

INSERT INTO "RecruitmentInterviewAspect" ("id", "label", "sortOrder", "active", "audience", "optional") VALUES
  ('ria_u_pengalaman', 'Pengalaman & Pengetahuan', 11, true, 'USER', false),
  ('ria_u_teknis', 'Keterampilan Teknis', 12, true, 'USER', false),
  ('ria_u_komunikasi', 'Komunikasi', 13, true, 'USER', false),
  ('ria_u_pendekatan', 'Pendekatan Kerja & Tanggung Jawab', 14, true, 'USER', false),
  ('ria_u_lapangan', 'Tes Lapangan', 15, true, 'USER', true),
  ('ria_h_pengalaman', 'Pengalaman & Pengetahuan', 21, true, 'HR', false),
  ('ria_h_teknis', 'Keterampilan Teknis', 22, true, 'HR', false),
  ('ria_h_komunikasi', 'Komunikasi', 23, true, 'HR', false),
  ('ria_h_pendekatan', 'Pendekatan Kerja & Tanggung Jawab', 24, true, 'HR', false),
  ('ria_h_energy', 'Energy', 25, true, 'HR', false),
  ('ria_h_energize', 'Energize', 26, true, 'HR', false);

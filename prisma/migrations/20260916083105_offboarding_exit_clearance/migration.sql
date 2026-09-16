-- AlterTable
ALTER TABLE "OffboardingCase" ADD COLUMN     "gaAssetClearanceConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "gaAssetClearanceConfirmedById" TEXT,
ADD COLUMN     "gaAssetClearanceNote" TEXT;

-- CreateTable
CREATE TABLE "ExitClearanceQuestion" (
    "id" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitClearanceQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitClearanceSubmission" (
    "id" TEXT NOT NULL,
    "offboardingCaseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitClearanceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitClearanceAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,

    CONSTRAINT "ExitClearanceAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExitClearanceSubmission_offboardingCaseId_key" ON "ExitClearanceSubmission"("offboardingCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExitClearanceAnswer_submissionId_questionId_key" ON "ExitClearanceAnswer"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_gaAssetClearanceConfirmedById_fkey" FOREIGN KEY ("gaAssetClearanceConfirmedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitClearanceSubmission" ADD CONSTRAINT "ExitClearanceSubmission_offboardingCaseId_fkey" FOREIGN KEY ("offboardingCaseId") REFERENCES "OffboardingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitClearanceSubmission" ADD CONSTRAINT "ExitClearanceSubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitClearanceAnswer" ADD CONSTRAINT "ExitClearanceAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ExitClearanceSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitClearanceAnswer" ADD CONSTRAINT "ExitClearanceAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExitClearanceQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Version after UAT: generic placeholder questions so HR Admin has
-- something real to see/edit immediately via the new admin page.
INSERT INTO "ExitClearanceQuestion" ("id", "questionText", "displayOrder", "activeFlag") VALUES
  ('seed-ecq-1', 'Apakah Anda telah mengembalikan seluruh aset perusahaan yang Anda pegang?', 1, true),
  ('seed-ecq-2', 'Apakah serah terima pekerjaan kepada atasan/pengganti Anda sudah selesai?', 2, true),
  ('seed-ecq-3', 'Apakah ada properti atau data perusahaan yang masih Anda simpan?', 3, true),
  ('seed-ecq-4', 'Apakah ada masukan atau alasan tambahan yang ingin Anda sampaikan terkait proses ini?', 4, true);


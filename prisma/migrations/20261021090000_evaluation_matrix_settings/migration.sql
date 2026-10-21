-- CreateEnum
CREATE TYPE "EvaluationSection" AS ENUM ('PERFORMANCE', 'TATA_NILAI');

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "matrixSnapshot" JSONB;

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" TEXT NOT NULL,
    "section" "EvaluationSection" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "guidelineFileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriterion_key_key" ON "EvaluationCriterion"("key");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_section_sortOrder_idx" ON "EvaluationCriterion"("section", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationSetting_guidelineFileId_key" ON "EvaluationSetting"("guidelineFileId");

-- AddForeignKey
ALTER TABLE "EvaluationSetting" ADD CONSTRAINT "EvaluationSetting_guidelineFileId_fkey" FOREIGN KEY ("guidelineFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The criteria the evaluation form has used so far become the starting matrix (same keys, so grades already
-- saved under them keep their meaning).
INSERT INTO "EvaluationCriterion" ("id", "section", "key", "label", "sortOrder", "active", "updatedAt") VALUES
  ('ecr_kualitasKerja', 'PERFORMANCE', 'kualitasKerja', 'Kualitas Kerja', 0, true, CURRENT_TIMESTAMP),
  ('ecr_komunikasi', 'PERFORMANCE', 'komunikasi', 'Komunikasi & Kolaborasi', 1, true, CURRENT_TIMESTAMP),
  ('ecr_pemecahanMasalah', 'PERFORMANCE', 'pemecahanMasalah', 'Pemecahan Masalah', 2, true, CURRENT_TIMESTAMP),
  ('ecr_pengambilanKeputusan', 'PERFORMANCE', 'pengambilanKeputusan', 'Pengambilan Keputusan', 3, true, CURRENT_TIMESTAMP),
  ('ecr_kepemimpinan', 'PERFORMANCE', 'kepemimpinan', 'Kepemimpinan', 4, true, CURRENT_TIMESTAMP),
  ('ecr_keahlianTeknis', 'PERFORMANCE', 'keahlianTeknis', 'Keahlian Teknis Pekerjaan', 5, true, CURRENT_TIMESTAMP),
  ('ecr_melayani', 'TATA_NILAI', 'melayani', 'Melayani Sepenuh Hati', 0, true, CURRENT_TIMESTAMP),
  ('ecr_jujur', 'TATA_NILAI', 'jujur', 'Bangga Berbuat Jujur', 1, true, CURRENT_TIMESTAMP),
  ('ecr_rencana', 'TATA_NILAI', 'rencana', 'Rencanakan apa yang dilakukan, lakukanlah apa yang sudah direncanakan', 2, true, CURRENT_TIMESTAMP),
  ('ecr_kemajuan', 'TATA_NILAI', 'kemajuan', 'Tiada hari tanpa kemajuan', 3, true, CURRENT_TIMESTAMP),
  ('ecr_legenda', 'TATA_NILAI', 'legenda', 'Bersama kita membuat legenda', 4, true, CURRENT_TIMESTAMP);

INSERT INTO "EvaluationSetting" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);

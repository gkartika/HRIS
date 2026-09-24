-- CreateTable
CREATE TABLE "OffboardingReasonOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OffboardingReasonOption_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OffboardingCase" ADD COLUMN "exitReasonId" TEXT;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_exitReasonId_fkey" FOREIGN KEY ("exitReasonId") REFERENCES "OffboardingReasonOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starter list (editable in Pengaturan > Offboarding > Alasan Keluar)
INSERT INTO "OffboardingReasonOption" ("id", "label", "displayOrder") VALUES
  ('offreason_pindah_kerja', 'Pengunduran diri — pindah kerja', 0),
  ('offreason_pendidikan', 'Pengunduran diri — melanjutkan pendidikan', 1),
  ('offreason_keluarga', 'Pengunduran diri — alasan keluarga / pindah domisili', 2),
  ('offreason_kesehatan', 'Pengunduran diri — alasan kesehatan', 3),
  ('offreason_pensiun', 'Pensiun', 4),
  ('offreason_kontrak', 'Kontrak tidak diperpanjang', 5),
  ('offreason_lainnya', 'Lainnya', 6);

-- CreateTable
CREATE TABLE "AbsenceTypeConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiresFirstApproval" BOOLEAN NOT NULL DEFAULT true,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceTypeConfig_code_key" ON "AbsenceTypeConfig"("code");

-- Seed the catalog with the 4 previously-hardcoded enum values, preserving
-- current behavior for all of them except SAKIT, which now skips the
-- first-approval stage per direct request.
INSERT INTO "AbsenceTypeConfig" ("id", "code", "label", "requiresFirstApproval", "activeFlag", "sortOrder", "updatedAt") VALUES
    ('absencetype-cuti-seed', 'CUTI', 'Cuti', true, true, 0, now()),
    ('absencetype-izin-seed', 'IZIN', 'Izin', true, true, 1, now()),
    ('absencetype-sakit-seed', 'SAKIT', 'Sakit', false, true, 2, now()),
    ('absencetype-lainnya-seed', 'LAINNYA', 'Lainnya', true, true, 3, now());

-- AlterTable: add the new FK column nullable first so existing rows can be
-- backfilled from the old enum column before it's dropped.
ALTER TABLE "AbsenceRequest" ADD COLUMN "absenceTypeCode" TEXT;
UPDATE "AbsenceRequest" SET "absenceTypeCode" = "absenceType"::text;
ALTER TABLE "AbsenceRequest" ALTER COLUMN "absenceTypeCode" SET NOT NULL;
ALTER TABLE "AbsenceRequest" DROP COLUMN "absenceType";

ALTER TABLE "AbsenceEntitlementConfig" ADD COLUMN "absenceTypeCode" TEXT;
UPDATE "AbsenceEntitlementConfig" SET "absenceTypeCode" = "absenceType"::text;
ALTER TABLE "AbsenceEntitlementConfig" ALTER COLUMN "absenceTypeCode" SET NOT NULL;
ALTER TABLE "AbsenceEntitlementConfig" DROP COLUMN "absenceType";

-- DropEnum
DROP TYPE "AbsenceType";

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceEntitlementConfig_absenceTypeCode_key" ON "AbsenceEntitlementConfig"("absenceTypeCode");

-- AddForeignKey
ALTER TABLE "AbsenceEntitlementConfig" ADD CONSTRAINT "AbsenceEntitlementConfig_absenceTypeCode_fkey" FOREIGN KEY ("absenceTypeCode") REFERENCES "AbsenceTypeConfig"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_absenceTypeCode_fkey" FOREIGN KEY ("absenceTypeCode") REFERENCES "AbsenceTypeConfig"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

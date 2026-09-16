-- Version after UAT: KTP/KK are now number-only fields (nationalIdNumber/
-- noKk), not uploaded documents. Delete the now-orphaned FileObject rows
-- before dropping the columns that referenced them, so no dead records are
-- left behind.
DELETE FROM "FileObject" WHERE "category" IN ('KTP', 'KK');

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_kkFileId_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_ktpFileId_fkey";

-- DropIndex
DROP INDEX "Employee_kkFileId_key";

-- DropIndex
DROP INDEX "Employee_ktpFileId_key";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "kkFileId",
DROP COLUMN "ktpFileId",
ADD COLUMN     "bpjsKesehatanFileId" TEXT,
ADD COLUMN     "bpjsTkFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_bpjsTkFileId_key" ON "Employee"("bpjsTkFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_bpjsKesehatanFileId_key" ON "Employee"("bpjsKesehatanFileId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_bpjsTkFileId_fkey" FOREIGN KEY ("bpjsTkFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_bpjsKesehatanFileId_fkey" FOREIGN KEY ("bpjsKesehatanFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;


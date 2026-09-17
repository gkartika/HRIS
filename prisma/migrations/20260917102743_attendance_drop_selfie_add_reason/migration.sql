-- DropForeignKey
ALTER TABLE "AttendanceEvent" DROP CONSTRAINT "AttendanceEvent_selfieFileId_fkey";

-- DropIndex
DROP INDEX "AttendanceEvent_selfieFileId_key";

-- AlterTable
ALTER TABLE "AttendanceEvent" DROP COLUMN "selfieFileId",
ADD COLUMN     "reason" TEXT;


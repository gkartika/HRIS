-- AlterTable
ALTER TABLE "AbsenceTypeConfig" ADD COLUMN     "countsTowardTdl" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "employeeRequestable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pointsWeight" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DailyAttendanceRecord" ADD COLUMN     "absenceTypeCode" TEXT,
ADD COLUMN     "classificationNote" TEXT,
ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "classifiedByAccountId" TEXT,
ADD COLUMN     "shiftType" "ShiftAssignmentType";

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_absenceTypeCode_fkey" FOREIGN KEY ("absenceTypeCode") REFERENCES "AbsenceTypeConfig"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_classifiedByAccountId_fkey" FOREIGN KEY ("classifiedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

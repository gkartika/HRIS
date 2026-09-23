-- AlterTable
ALTER TABLE "AbsenceTypeConfig" ADD COLUMN     "hoursMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WorkScheduleConfig" (
    "id" TEXT NOT NULL,
    "shiftType" "ShiftAssignmentType" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleConfig_shiftType_dayOfWeek_key" ON "WorkScheduleConfig"("shiftType", "dayOfWeek");

-- Additive only: when each shift starts and how many minutes of grace a
-- check-in gets before it counts as late. Shift 1 starts filled in with the
-- company's old fixed rule (07:30, 10 minutes); Shift 2 and Shift 3 stay empty
-- until Admin SDM enters their times, and an empty start time is never late.
-- CreateTable
CREATE TABLE "ShiftStartConfig" (
    "id" TEXT NOT NULL,
    "shiftType" "ShiftAssignmentType" NOT NULL,
    "startTime" TEXT,
    "graceMinutes" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftStartConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftStartConfig_shiftType_key" ON "ShiftStartConfig"("shiftType");

-- Seed: Shift 1 keeps today's behaviour
INSERT INTO "ShiftStartConfig" ("id", "shiftType", "startTime", "graceMinutes", "updatedAt")
VALUES ('shift-start-shift-1', 'SHIFT_1', '07:30', 10, CURRENT_TIMESTAMP);

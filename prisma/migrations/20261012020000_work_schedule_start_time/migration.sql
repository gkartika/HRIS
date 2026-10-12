-- Additive only: the start time now belongs to each shift AND weekday (Shift 2
-- and Shift 3 start at different times on different days). A null start time
-- means "not set", which is never late. Shift 1's old single start time is
-- copied onto its working days so nothing changes for it. The grace minutes stay
-- one number per shift (ShiftStartConfig.graceMinutes); ShiftStartConfig.startTime
-- is no longer read.
-- AlterTable
ALTER TABLE "WorkScheduleConfig" ADD COLUMN "startTime" TEXT;

-- Copy the existing per-shift start time onto the days that have working minutes
UPDATE "WorkScheduleConfig" w
SET "startTime" = s."startTime"
FROM "ShiftStartConfig" s
WHERE s."shiftType" = w."shiftType" AND s."startTime" IS NOT NULL AND w."minutes" > 0;

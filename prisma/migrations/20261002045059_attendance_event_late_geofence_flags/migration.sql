-- AlterTable
ALTER TABLE "AttendanceEvent" ADD COLUMN     "late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withinGeofence" BOOLEAN;

-- DropIndex
DROP INDEX "WorkSchedule_scheduleName_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WorkSchedule";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "geofenceId" TEXT,
    "fingerprintDeviceUserId" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceAssignment_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "AttendanceGeofence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceAssignment" ("assignedAt", "assignedByAccountId", "createdAt", "effectiveFrom", "effectiveTo", "employeeId", "fingerprintDeviceUserId", "geofenceId", "id", "method") SELECT "assignedAt", "assignedByAccountId", "createdAt", "effectiveFrom", "effectiveTo", "employeeId", "fingerprintDeviceUserId", "geofenceId", "id", "method" FROM "AttendanceAssignment";
DROP TABLE "AttendanceAssignment";
ALTER TABLE "new_AttendanceAssignment" RENAME TO "AttendanceAssignment";
CREATE TABLE "new_DailyAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATETIME NOT NULL,
    "checkInEventId" TEXT,
    "checkOutEventId" TEXT,
    "reconciledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyAttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyAttendanceRecord_checkInEventId_fkey" FOREIGN KEY ("checkInEventId") REFERENCES "AttendanceEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyAttendanceRecord_checkOutEventId_fkey" FOREIGN KEY ("checkOutEventId") REFERENCES "AttendanceEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyAttendanceRecord" ("attendanceDate", "checkInEventId", "checkOutEventId", "employeeId", "id", "reconciledAt") SELECT "attendanceDate", "checkInEventId", "checkOutEventId", "employeeId", "id", "reconciledAt" FROM "DailyAttendanceRecord";
DROP TABLE "DailyAttendanceRecord";
ALTER TABLE "new_DailyAttendanceRecord" RENAME TO "DailyAttendanceRecord";
CREATE UNIQUE INDEX "DailyAttendanceRecord_checkInEventId_key" ON "DailyAttendanceRecord"("checkInEventId");
CREATE UNIQUE INDEX "DailyAttendanceRecord_checkOutEventId_key" ON "DailyAttendanceRecord"("checkOutEventId");
CREATE UNIQUE INDEX "DailyAttendanceRecord_employeeId_attendanceDate_key" ON "DailyAttendanceRecord"("employeeId", "attendanceDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


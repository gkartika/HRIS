-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "attendanceAssignmentId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL,
    "eventAt" DATETIME NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "geofenceId" TEXT,
    "selfieFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_attendanceAssignmentId_fkey" FOREIGN KEY ("attendanceAssignmentId") REFERENCES "AttendanceAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "AttendanceGeofence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_selfieFileId_fkey" FOREIGN KEY ("selfieFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceEvent" ("attendanceAssignmentId", "createdAt", "employeeId", "eventAt", "eventSource", "eventType", "geofenceId", "id", "latitude", "longitude", "selfieFileId") SELECT "attendanceAssignmentId", "createdAt", "employeeId", "eventAt", "eventSource", "eventType", "geofenceId", "id", "latitude", "longitude", "selfieFileId" FROM "AttendanceEvent";
DROP TABLE "AttendanceEvent";
ALTER TABLE "new_AttendanceEvent" RENAME TO "AttendanceEvent";
CREATE UNIQUE INDEX "AttendanceEvent_selfieFileId_key" ON "AttendanceEvent"("selfieFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


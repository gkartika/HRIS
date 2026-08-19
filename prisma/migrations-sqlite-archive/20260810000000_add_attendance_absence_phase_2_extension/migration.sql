-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "workDaysCsv" TEXT NOT NULL,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AttendanceGeofence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteName" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AttendanceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "geofenceId" TEXT,
    "fingerprintDeviceUserId" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceAssignment_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceAssignment_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "AttendanceGeofence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
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
    "importRowId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_attendanceAssignmentId_fkey" FOREIGN KEY ("attendanceAssignmentId") REFERENCES "AttendanceAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "AttendanceGeofence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_selfieFileId_fkey" FOREIGN KEY ("selfieFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceEvent_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATETIME NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "checkInEventId" TEXT,
    "checkOutEventId" TEXT,
    "reconciledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyAttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyAttendanceRecord_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyAttendanceRecord_checkInEventId_fkey" FOREIGN KEY ("checkInEventId") REFERENCES "AttendanceEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyAttendanceRecord_checkOutEventId_fkey" FOREIGN KEY ("checkOutEventId") REFERENCES "AttendanceEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbsenceApproverConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "approverPositionId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AbsenceApproverConfig_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AbsenceApproverConfig_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbsenceEntitlementConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "absenceType" TEXT NOT NULL,
    "annualDays" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AbsenceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "firstApproverPositionId" TEXT,
    "firstDecisionAt" DATETIME,
    "firstDecisionByAccountId" TEXT,
    "firstDecisionNote" TEXT,
    "hrAdminDecisionAt" DATETIME,
    "hrAdminDecisionByAccountId" TEXT,
    "hrAdminDecisionNote" TEXT,
    "isHrOverride" BOOLEAN NOT NULL DEFAULT false,
    "hrOverrideReason" TEXT,
    "hrOverrideAt" DATETIME,
    "hrOverrideByAccountId" TEXT,
    "cancelledAt" DATETIME,
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AbsenceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_attachmentFileId_fkey" FOREIGN KEY ("attachmentFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_firstApproverPositionId_fkey" FOREIGN KEY ("firstApproverPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_firstDecisionByAccountId_fkey" FOREIGN KEY ("firstDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_hrAdminDecisionByAccountId_fkey" FOREIGN KEY ("hrAdminDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_hrOverrideByAccountId_fkey" FOREIGN KEY ("hrOverrideByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AbsenceRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_scheduleName_key" ON "WorkSchedule"("scheduleName");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceGeofence_siteName_key" ON "AttendanceGeofence"("siteName");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_selfieFileId_key" ON "AttendanceEvent"("selfieFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_importRowId_key" ON "AttendanceEvent"("importRowId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_checkInEventId_key" ON "DailyAttendanceRecord"("checkInEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_checkOutEventId_key" ON "DailyAttendanceRecord"("checkOutEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_employeeId_attendanceDate_key" ON "DailyAttendanceRecord"("employeeId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceApproverConfig_departmentId_key" ON "AbsenceApproverConfig"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceEntitlementConfig_absenceType_key" ON "AbsenceEntitlementConfig"("absenceType");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRequest_requestNumber_key" ON "AbsenceRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRequest_attachmentFileId_key" ON "AbsenceRequest"("attachmentFileId");


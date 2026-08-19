-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MovementRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "currentPositionId" TEXT NOT NULL,
    "currentAssignmentId" TEXT,
    "proposedPositionId" TEXT NOT NULL,
    "proposedEmploymentStatus" TEXT,
    "proposedEffectiveDate" DATETIME NOT NULL,
    "requestReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requesterEmployeeId" TEXT NOT NULL,
    "requesterPositionId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "deptHeadDecisionAt" DATETIME,
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadDecisionNote" TEXT,
    "decisionAt" DATETIME,
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "attendanceAlpha" INTEGER,
    "attendanceSakit" INTEGER,
    "attendanceIjin" INTEGER,
    "attendanceIjinHalfDay" INTEGER,
    "attendanceCuti" INTEGER,
    "performanceEvaluationRef" TEXT,
    "performanceEvaluationFileId" TEXT,
    "hrConfidentialNotes" TEXT,
    "implementedAt" DATETIME,
    "implementedByAccountId" TEXT,
    "implementedAssignmentId" TEXT,
    "cancelledAt" DATETIME,
    "cancelledByAccountId" TEXT,
    "cancelledByEmployeeId" TEXT,
    "cancellationAuthority" TEXT,
    "cancellationReason" TEXT,
    "previousStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MovementRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_currentAssignmentId_fkey" FOREIGN KEY ("currentAssignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_proposedPositionId_fkey" FOREIGN KEY ("proposedPositionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_requesterPositionId_fkey" FOREIGN KEY ("requesterPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_performanceEvaluationFileId_fkey" FOREIGN KEY ("performanceEvaluationFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_implementedByAccountId_fkey" FOREIGN KEY ("implementedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_implementedAssignmentId_fkey" FOREIGN KEY ("implementedAssignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_cancelledByEmployeeId_fkey" FOREIGN KEY ("cancelledByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MovementRequest" ("cancellationAuthority", "cancellationReason", "cancelledAt", "cancelledByAccountId", "cancelledByEmployeeId", "createdAt", "currentPositionId", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "employeeId", "id", "implementedAssignmentId", "implementedAt", "implementedByAccountId", "movementType", "previousStatus", "proposedEffectiveDate", "proposedEmploymentStatus", "proposedPositionId", "requestNumber", "requestReason", "requesterEmployeeId", "requesterPositionId", "status", "submittedAt", "submittedByAccountId", "updatedAt") SELECT "cancellationAuthority", "cancellationReason", "cancelledAt", "cancelledByAccountId", "cancelledByEmployeeId", "createdAt", "currentPositionId", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "employeeId", "id", "implementedAssignmentId", "implementedAt", "implementedByAccountId", "movementType", "previousStatus", "proposedEffectiveDate", "proposedEmploymentStatus", "proposedPositionId", "requestNumber", "requestReason", "requesterEmployeeId", "requesterPositionId", "status", "submittedAt", "submittedByAccountId", "updatedAt" FROM "MovementRequest";
DROP TABLE "MovementRequest";
ALTER TABLE "new_MovementRequest" RENAME TO "MovementRequest";
CREATE UNIQUE INDEX "MovementRequest_requestNumber_key" ON "MovementRequest"("requestNumber");
CREATE UNIQUE INDEX "MovementRequest_performanceEvaluationFileId_key" ON "MovementRequest"("performanceEvaluationFileId");
CREATE UNIQUE INDEX "MovementRequest_implementedAssignmentId_key" ON "MovementRequest"("implementedAssignmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

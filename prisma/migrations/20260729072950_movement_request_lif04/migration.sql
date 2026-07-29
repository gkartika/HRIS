-- CreateTable
CREATE TABLE "MovementRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "currentPositionId" TEXT NOT NULL,
    "proposedPositionId" TEXT NOT NULL,
    "proposedEmploymentStatus" TEXT,
    "proposedEffectiveDate" DATETIME NOT NULL,
    "requestReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requesterEmployeeId" TEXT NOT NULL,
    "requesterPositionId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "decisionAt" DATETIME,
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
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
    CONSTRAINT "MovementRequest_proposedPositionId_fkey" FOREIGN KEY ("proposedPositionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_requesterPositionId_fkey" FOREIGN KEY ("requesterPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_implementedByAccountId_fkey" FOREIGN KEY ("implementedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_implementedAssignmentId_fkey" FOREIGN KEY ("implementedAssignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovementRequest_cancelledByEmployeeId_fkey" FOREIGN KEY ("cancelledByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MovementRequest_requestNumber_key" ON "MovementRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MovementRequest_implementedAssignmentId_key" ON "MovementRequest"("implementedAssignmentId");

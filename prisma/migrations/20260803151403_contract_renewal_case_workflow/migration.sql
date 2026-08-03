-- CreateTable
CREATE TABLE "ContractRenewalCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "currentContractId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "primaryAssignmentId" TEXT NOT NULL,
    "snapshotPositionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIGGERED',
    "triggerDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleHrAdminAccountId" TEXT,
    "sentAt" DATETIME,
    "evaluationDueDate" DATETIME,
    "attendanceSakit" INTEGER,
    "attendanceIjin" INTEGER,
    "attendanceAlpha" INTEGER,
    "attendanceIjinHalfDay" INTEGER,
    "p1EmployeeId" TEXT,
    "p1PositionId" TEXT,
    "p1SubmittedAt" DATETIME,
    "p1Scores" JSONB,
    "p1Total" INTEGER,
    "p2EmployeeId" TEXT,
    "p2PositionId" TEXT,
    "p2SubmittedAt" DATETIME,
    "p2Scores" JSONB,
    "p2Total" INTEGER,
    "deptHeadEmployeeId" TEXT,
    "deptHeadPositionId" TEXT,
    "deptHeadRecommendedAt" DATETIME,
    "deptHeadRecommendation" TEXT,
    "deptHeadProposedDurationMonths" INTEGER,
    "deptHeadProposedPositionId" TEXT,
    "deptHeadNote" TEXT,
    "linkedMovementRequestId" TEXT,
    "decisionAt" DATETIME,
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "finalRecommendation" TEXT,
    "changeReason" TEXT,
    "decisionNote" TEXT,
    "generatedContractId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractRenewalCase_currentContractId_fkey" FOREIGN KEY ("currentContractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_snapshotPositionId_fkey" FOREIGN KEY ("snapshotPositionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_responsibleHrAdminAccountId_fkey" FOREIGN KEY ("responsibleHrAdminAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_p1EmployeeId_fkey" FOREIGN KEY ("p1EmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_p1PositionId_fkey" FOREIGN KEY ("p1PositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_p2EmployeeId_fkey" FOREIGN KEY ("p2EmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_p2PositionId_fkey" FOREIGN KEY ("p2PositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_deptHeadEmployeeId_fkey" FOREIGN KEY ("deptHeadEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_deptHeadPositionId_fkey" FOREIGN KEY ("deptHeadPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_deptHeadProposedPositionId_fkey" FOREIGN KEY ("deptHeadProposedPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_linkedMovementRequestId_fkey" FOREIGN KEY ("linkedMovementRequestId") REFERENCES "MovementRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_generatedContractId_fkey" FOREIGN KEY ("generatedContractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_caseNumber_key" ON "ContractRenewalCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_currentContractId_key" ON "ContractRenewalCase"("currentContractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_linkedMovementRequestId_key" ON "ContractRenewalCase"("linkedMovementRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_generatedContractId_key" ON "ContractRenewalCase"("generatedContractId");

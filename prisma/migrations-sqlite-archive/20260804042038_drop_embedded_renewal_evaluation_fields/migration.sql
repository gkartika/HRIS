-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContractRenewalCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "currentContractId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "primaryAssignmentId" TEXT NOT NULL,
    "snapshotPositionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIGGERED',
    "triggerDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluationId" TEXT,
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
    CONSTRAINT "ContractRenewalCase_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_deptHeadEmployeeId_fkey" FOREIGN KEY ("deptHeadEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_deptHeadPositionId_fkey" FOREIGN KEY ("deptHeadPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_deptHeadProposedPositionId_fkey" FOREIGN KEY ("deptHeadProposedPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_linkedMovementRequestId_fkey" FOREIGN KEY ("linkedMovementRequestId") REFERENCES "MovementRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractRenewalCase_generatedContractId_fkey" FOREIGN KEY ("generatedContractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ContractRenewalCase" ("caseNumber", "changeReason", "createdAt", "currentContractId", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "deptHeadEmployeeId", "deptHeadNote", "deptHeadPositionId", "deptHeadProposedDurationMonths", "deptHeadProposedPositionId", "deptHeadRecommendation", "deptHeadRecommendedAt", "employeeId", "evaluationId", "finalRecommendation", "generatedContractId", "id", "linkedMovementRequestId", "primaryAssignmentId", "snapshotPositionId", "status", "triggerDate", "updatedAt") SELECT "caseNumber", "changeReason", "createdAt", "currentContractId", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "deptHeadEmployeeId", "deptHeadNote", "deptHeadPositionId", "deptHeadProposedDurationMonths", "deptHeadProposedPositionId", "deptHeadRecommendation", "deptHeadRecommendedAt", "employeeId", "evaluationId", "finalRecommendation", "generatedContractId", "id", "linkedMovementRequestId", "primaryAssignmentId", "snapshotPositionId", "status", "triggerDate", "updatedAt" FROM "ContractRenewalCase";
DROP TABLE "ContractRenewalCase";
ALTER TABLE "new_ContractRenewalCase" RENAME TO "ContractRenewalCase";
CREATE UNIQUE INDEX "ContractRenewalCase_caseNumber_key" ON "ContractRenewalCase"("caseNumber");
CREATE UNIQUE INDEX "ContractRenewalCase_currentContractId_key" ON "ContractRenewalCase"("currentContractId");
CREATE UNIQUE INDEX "ContractRenewalCase_evaluationId_key" ON "ContractRenewalCase"("evaluationId");
CREATE UNIQUE INDEX "ContractRenewalCase_linkedMovementRequestId_key" ON "ContractRenewalCase"("linkedMovementRequestId");
CREATE UNIQUE INDEX "ContractRenewalCase_generatedContractId_key" ON "ContractRenewalCase"("generatedContractId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


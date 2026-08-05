-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "weekStartDate" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL,
    "note" TEXT,
    "isHrOverride" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "submittedByPositionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftAssignment_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftAssignment_submittedByPositionId_fkey" FOREIGN KEY ("submittedByPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "renewedFromContractId" TEXT,
    "reviewRequestedAt" DATETIME,
    "recommendationSubmittedAt" DATETIME,
    "recommendationByEmployeeId" TEXT,
    "recommendationByPositionId" TEXT,
    "recommendation" TEXT,
    "recommendationNote" TEXT,
    "decisionAt" DATETIME,
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "notRenewedReason" TEXT,
    "draftedAt" DATETIME,
    "releasedAt" DATETIME,
    "releasedByAccountId" TEXT,
    "releasedByPositionId" TEXT,
    "signedAt" DATETIME,
    "activatedAt" DATETIME,
    "contractFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_renewedFromContractId_fkey" FOREIGN KEY ("renewedFromContractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_recommendationByEmployeeId_fkey" FOREIGN KEY ("recommendationByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_recommendationByPositionId_fkey" FOREIGN KEY ("recommendationByPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_releasedByAccountId_fkey" FOREIGN KEY ("releasedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_releasedByPositionId_fkey" FOREIGN KEY ("releasedByPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_contractFileId_fkey" FOREIGN KEY ("contractFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("activatedAt", "contractFileId", "contractNumber", "contractType", "createdAt", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "draftedAt", "employeeId", "endDate", "id", "notRenewedReason", "recommendation", "recommendationByEmployeeId", "recommendationByPositionId", "recommendationNote", "recommendationSubmittedAt", "releasedAt", "renewedFromContractId", "reviewRequestedAt", "signedAt", "startDate", "status", "updatedAt") SELECT "activatedAt", "contractFileId", "contractNumber", "contractType", "createdAt", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "draftedAt", "employeeId", "endDate", "id", "notRenewedReason", "recommendation", "recommendationByEmployeeId", "recommendationByPositionId", "recommendationNote", "recommendationSubmittedAt", "releasedAt", "renewedFromContractId", "reviewRequestedAt", "signedAt", "startDate", "status", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_renewedFromContractId_key" ON "Contract"("renewedFromContractId");
CREATE UNIQUE INDEX "Contract_contractFileId_key" ON "Contract"("contractFileId");
CREATE TABLE "new_OffboardingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_HR_MANAGER',
    "lastWorkingDay" DATETIME NOT NULL,
    "clearanceDueDate" DATETIME NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedByAccountId" TEXT,
    "managerNote" TEXT,
    "sourceRenewalCaseId" TEXT,
    "deptHeadDecisionAt" DATETIME,
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadNote" TEXT,
    "hrManagerDecisionAt" DATETIME,
    "hrManagerDecisionByAccountId" TEXT,
    "hrManagerDecisionPositionId" TEXT,
    "hrManagerNote" TEXT,
    "clearanceCompletedAt" DATETIME,
    "clearanceCompletedByAccountId" TEXT,
    "clearanceNote" TEXT,
    "cancelledAt" DATETIME,
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OffboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_reportedByAccountId_fkey" FOREIGN KEY ("reportedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_sourceRenewalCaseId_fkey" FOREIGN KEY ("sourceRenewalCaseId") REFERENCES "ContractRenewalCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_hrManagerDecisionByAccountId_fkey" FOREIGN KEY ("hrManagerDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_hrManagerDecisionPositionId_fkey" FOREIGN KEY ("hrManagerDecisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_clearanceCompletedByAccountId_fkey" FOREIGN KEY ("clearanceCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OffboardingCase" ("cancellationReason", "cancelledAt", "cancelledByAccountId", "caseNumber", "clearanceCompletedAt", "clearanceCompletedByAccountId", "clearanceDueDate", "clearanceNote", "createdAt", "employeeId", "hrManagerDecisionAt", "hrManagerDecisionByAccountId", "hrManagerDecisionPositionId", "hrManagerNote", "id", "lastWorkingDay", "managerNote", "reason", "reportedAt", "reportedByAccountId", "sourceRenewalCaseId", "status", "updatedAt") SELECT "cancellationReason", "cancelledAt", "cancelledByAccountId", "caseNumber", "clearanceCompletedAt", "clearanceCompletedByAccountId", "clearanceDueDate", "clearanceNote", "createdAt", "employeeId", "hrManagerDecisionAt", "hrManagerDecisionByAccountId", "hrManagerDecisionPositionId", "hrManagerNote", "id", "lastWorkingDay", "managerNote", "reason", "reportedAt", "reportedByAccountId", "sourceRenewalCaseId", "status", "updatedAt" FROM "OffboardingCase";
DROP TABLE "OffboardingCase";
ALTER TABLE "new_OffboardingCase" RENAME TO "OffboardingCase";
CREATE UNIQUE INDEX "OffboardingCase_caseNumber_key" ON "OffboardingCase"("caseNumber");
CREATE UNIQUE INDEX "OffboardingCase_sourceRenewalCaseId_key" ON "OffboardingCase"("sourceRenewalCaseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_employeeId_weekStartDate_key" ON "ShiftAssignment"("employeeId", "weekStartDate");

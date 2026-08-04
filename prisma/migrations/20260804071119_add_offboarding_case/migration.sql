-- CreateTable
CREATE TABLE "OffboardingCase" (
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
    CONSTRAINT "OffboardingCase_hrManagerDecisionByAccountId_fkey" FOREIGN KEY ("hrManagerDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_hrManagerDecisionPositionId_fkey" FOREIGN KEY ("hrManagerDecisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_clearanceCompletedByAccountId_fkey" FOREIGN KEY ("clearanceCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OffboardingCase_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OffboardingCase_caseNumber_key" ON "OffboardingCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OffboardingCase_sourceRenewalCaseId_key" ON "OffboardingCase"("sourceRenewalCaseId");

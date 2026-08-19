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
    "primaryAssignmentId" TEXT,
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
    CONSTRAINT "Contract_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_renewedFromContractId_fkey" FOREIGN KEY ("renewedFromContractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_recommendationByEmployeeId_fkey" FOREIGN KEY ("recommendationByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_recommendationByPositionId_fkey" FOREIGN KEY ("recommendationByPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_releasedByAccountId_fkey" FOREIGN KEY ("releasedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_releasedByPositionId_fkey" FOREIGN KEY ("releasedByPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_contractFileId_fkey" FOREIGN KEY ("contractFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("activatedAt", "contractFileId", "contractNumber", "contractType", "createdAt", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "draftedAt", "employeeId", "endDate", "id", "notRenewedReason", "recommendation", "recommendationByEmployeeId", "recommendationByPositionId", "recommendationNote", "recommendationSubmittedAt", "releasedAt", "releasedByAccountId", "releasedByPositionId", "renewedFromContractId", "reviewRequestedAt", "signedAt", "startDate", "status", "updatedAt") SELECT "activatedAt", "contractFileId", "contractNumber", "contractType", "createdAt", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "draftedAt", "employeeId", "endDate", "id", "notRenewedReason", "recommendation", "recommendationByEmployeeId", "recommendationByPositionId", "recommendationNote", "recommendationSubmittedAt", "releasedAt", "releasedByAccountId", "releasedByPositionId", "renewedFromContractId", "reviewRequestedAt", "signedAt", "startDate", "status", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_renewedFromContractId_key" ON "Contract"("renewedFromContractId");
CREATE UNIQUE INDEX "Contract_contractFileId_key" ON "Contract"("contractFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OnboardingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "plannedStartDate" DATETIME NOT NULL,
    "contractComplete" BOOLEAN NOT NULL DEFAULT false,
    "contractCompletedAt" DATETIME,
    "contractCompletedByAccountId" TEXT,
    "mandatoryMaterialDueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnboardingCase_contractCompletedByAccountId_fkey" FOREIGN KEY ("contractCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OnboardingCase" ("caseNumber", "completedAt", "contractComplete", "contractCompletedAt", "contractCompletedByAccountId", "createdAt", "employeeId", "id", "mandatoryMaterialDueDate", "plannedStartDate", "updatedAt") SELECT "caseNumber", "completedAt", "contractComplete", "contractCompletedAt", "contractCompletedByAccountId", "createdAt", "employeeId", "id", "mandatoryMaterialDueDate", "plannedStartDate", "updatedAt" FROM "OnboardingCase";
DROP TABLE "OnboardingCase";
ALTER TABLE "new_OnboardingCase" RENAME TO "OnboardingCase";
CREATE UNIQUE INDEX "OnboardingCase_caseNumber_key" ON "OnboardingCase"("caseNumber");
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

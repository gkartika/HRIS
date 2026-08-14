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
    "assetsComplete" BOOLEAN NOT NULL DEFAULT false,
    "assetsCompletedAt" DATETIME,
    "assetsCompletedByAccountId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnboardingCase_contractCompletedByAccountId_fkey" FOREIGN KEY ("contractCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OnboardingCase_assetsCompletedByAccountId_fkey" FOREIGN KEY ("assetsCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OnboardingCase" ("assetsComplete", "assetsCompletedAt", "assetsCompletedByAccountId", "caseNumber", "completedAt", "contractComplete", "contractCompletedAt", "contractCompletedByAccountId", "createdAt", "employeeId", "id", "mandatoryMaterialDueDate", "plannedStartDate", "updatedAt") SELECT "assetsComplete", "assetsCompletedAt", "assetsCompletedByAccountId", "caseNumber", "completedAt", "contractComplete", "contractCompletedAt", "contractCompletedByAccountId", "createdAt", "employeeId", "id", "mandatoryMaterialDueDate", "plannedStartDate", "updatedAt" FROM "OnboardingCase";
DROP TABLE "OnboardingCase";
ALTER TABLE "new_OnboardingCase" RENAME TO "OnboardingCase";
CREATE UNIQUE INDEX "OnboardingCase_caseNumber_key" ON "OnboardingCase"("caseNumber");
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");
CREATE TABLE "new_TrainingCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "provider" TEXT,
    "deliveryMethod" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "objectives" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isOnboardingRequired" BOOLEAN NOT NULL DEFAULT false,
    "plannedCost" REAL,
    "actualCost" REAL,
    "certificateRequired" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessRequired" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessFollowupDays" INTEGER NOT NULL DEFAULT 30,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingCourse_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TrainingCourse" ("activeFlag", "actualCost", "category", "certificateRequired", "createdAt", "createdByAccountId", "deliveryMethod", "effectivenessFollowupDays", "effectivenessRequired", "id", "mode", "objectives", "plannedCost", "provider", "status", "title") SELECT "activeFlag", "actualCost", "category", "certificateRequired", "createdAt", "createdByAccountId", "deliveryMethod", "effectivenessFollowupDays", "effectivenessRequired", "id", "mode", "objectives", "plannedCost", "provider", "status", "title" FROM "TrainingCourse";
DROP TABLE "TrainingCourse";
ALTER TABLE "new_TrainingCourse" RENAME TO "TrainingCourse";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


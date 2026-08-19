-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "plannedStartDate" DATETIME NOT NULL,
    "contractComplete" BOOLEAN NOT NULL DEFAULT false,
    "contractCompletedAt" DATETIME,
    "contractCompletedByAccountId" TEXT,
    "mandatoryMaterialComplete" BOOLEAN NOT NULL DEFAULT false,
    "mandatoryMaterialDueDate" DATETIME,
    "mandatoryMaterialCompletedAt" DATETIME,
    "mandatoryMaterialCompletedByAccountId" TEXT,
    "assetsComplete" BOOLEAN NOT NULL DEFAULT false,
    "assetsCompletedAt" DATETIME,
    "assetsCompletedByAccountId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnboardingCase_contractCompletedByAccountId_fkey" FOREIGN KEY ("contractCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OnboardingCase_mandatoryMaterialCompletedByAccountId_fkey" FOREIGN KEY ("mandatoryMaterialCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OnboardingCase_assetsCompletedByAccountId_fkey" FOREIGN KEY ("assetsCompletedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_caseNumber_key" ON "OnboardingCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");

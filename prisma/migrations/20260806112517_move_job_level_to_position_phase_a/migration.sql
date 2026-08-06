-- AlterTable
ALTER TABLE "Position" ADD COLUMN "jobLevel" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobCode" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobPurpose" TEXT,
    "pdcaPlan" TEXT,
    "pdcaDo" TEXT,
    "pdcaCheck" TEXT,
    "pdcaAct" TEXT,
    "decisionAuthority" TEXT,
    "keyCollaboration" TEXT,
    "jobVersion" INTEGER NOT NULL DEFAULT 1,
    "approvalStatus" TEXT NOT NULL DEFAULT 'Approved',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("approvalStatus", "createdAt", "decisionAuthority", "id", "jobCode", "jobPurpose", "jobTitle", "jobVersion", "keyCollaboration", "pdcaAct", "pdcaCheck", "pdcaDo", "pdcaPlan", "updatedAt") SELECT "approvalStatus", "createdAt", "decisionAuthority", "id", "jobCode", "jobPurpose", "jobTitle", "jobVersion", "keyCollaboration", "pdcaAct", "pdcaCheck", "pdcaDo", "pdcaPlan", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE UNIQUE INDEX "Job_jobCode_key" ON "Job"("jobCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

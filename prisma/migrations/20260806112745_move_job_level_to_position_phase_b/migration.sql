-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionCode" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobLevel" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "positionType" TEXT NOT NULL,
    "approvedFte" REAL NOT NULL DEFAULT 1,
    "positionStatus" TEXT NOT NULL DEFAULT 'VACANT',
    "grantsHrManagerAccess" BOOLEAN NOT NULL DEFAULT false,
    "reportsToPositionId" TEXT,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    CONSTRAINT "Position_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Position_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Position_reportsToPositionId_fkey" FOREIGN KEY ("reportsToPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Position" ("approvedFte", "effectiveFrom", "effectiveTo", "grantsHrManagerAccess", "id", "jobId", "jobLevel", "orgUnitId", "positionCode", "positionStatus", "positionType", "reportsToPositionId") SELECT "approvedFte", "effectiveFrom", "effectiveTo", "grantsHrManagerAccess", "id", "jobId", "jobLevel", "orgUnitId", "positionCode", "positionStatus", "positionType", "reportsToPositionId" FROM "Position";
DROP TABLE "Position";
ALTER TABLE "new_Position" RENAME TO "Position";
CREATE UNIQUE INDEX "Position_positionCode_key" ON "Position"("positionCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

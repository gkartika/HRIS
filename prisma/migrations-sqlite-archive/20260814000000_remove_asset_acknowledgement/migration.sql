-- Data fix-up: any existing custody still sitting in the now-removed
-- PENDING_ACKNOWLEDGEMENT status is promoted to ACTIVE, matching what
-- would have happened if acknowledgement had never been required.
UPDATE "AssetCustody" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING_ACKNOWLEDGEMENT';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssetCustody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "employeeId" TEXT,
    "orgUnitId" TEXT,
    "locationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "conditionAtHandover" TEXT,
    "handoverEvidenceFileId" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByAccountId" TEXT NOT NULL,
    "returnedAt" DATETIME,
    "returnedByAccountId" TEXT,
    "returnConditionNote" TEXT,
    "returnEvidenceFileId" TEXT,
    "inspectionResult" TEXT,
    "transferredToCustodyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetCustody_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_handoverEvidenceFileId_fkey" FOREIGN KEY ("handoverEvidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_returnedByAccountId_fkey" FOREIGN KEY ("returnedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetCustody_returnEvidenceFileId_fkey" FOREIGN KEY ("returnEvidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AssetCustody" ("assetId", "assignedAt", "assignedByAccountId", "conditionAtHandover", "createdAt", "employeeId", "handoverEvidenceFileId", "id", "inspectionResult", "locationId", "orgUnitId", "quantity", "returnConditionNote", "returnEvidenceFileId", "returnedAt", "returnedByAccountId", "status", "targetType", "transferredToCustodyId") SELECT "assetId", "assignedAt", "assignedByAccountId", "conditionAtHandover", "createdAt", "employeeId", "handoverEvidenceFileId", "id", "inspectionResult", "locationId", "orgUnitId", "quantity", "returnConditionNote", "returnEvidenceFileId", "returnedAt", "returnedByAccountId", "status", "targetType", "transferredToCustodyId" FROM "AssetCustody";
DROP TABLE "AssetCustody";
ALTER TABLE "new_AssetCustody" RENAME TO "AssetCustody";
CREATE UNIQUE INDEX "AssetCustody_handoverEvidenceFileId_key" ON "AssetCustody"("handoverEvidenceFileId");
CREATE UNIQUE INDEX "AssetCustody_returnEvidenceFileId_key" ON "AssetCustody"("returnEvidenceFileId");
CREATE UNIQUE INDEX "AssetCustody_transferredToCustodyId_key" ON "AssetCustody"("transferredToCustodyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

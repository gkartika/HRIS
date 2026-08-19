-- CreateTable
CREATE TABLE "AssetLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationName" TEXT NOT NULL,
    "description" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetCode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT,
    "trackingType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "totalQuantity" INTEGER,
    "availableQuantity" INTEGER,
    "purchaseDate" DATETIME,
    "purchaseCost" REAL,
    "notes" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedAsset_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetCustody" (
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
    "acknowledgedAt" DATETIME,
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

-- CreateIndex
CREATE UNIQUE INDEX "AssetLocation_locationName_key" ON "AssetLocation"("locationName");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetCode_key" ON "FixedAsset"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCustody_handoverEvidenceFileId_key" ON "AssetCustody"("handoverEvidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCustody_returnEvidenceFileId_key" ON "AssetCustody"("returnEvidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCustody_transferredToCustodyId_key" ON "AssetCustody"("transferredToCustodyId");


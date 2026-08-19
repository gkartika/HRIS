
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GaRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "requesterEmployeeId" TEXT NOT NULL,
    "submittedByAccountId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT,
    "locationId" TEXT,
    "verifiedAt" DATETIME,
    "verifiedByAccountId" TEXT,
    "verificationNote" TEXT,
    "approvalRequired" BOOLEAN,
    "decisionAt" DATETIME,
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "procurementReference" TEXT,
    "resultingCustodyId" TEXT,
    "processedAt" DATETIME,
    "processedByAccountId" TEXT,
    "lossReviewedAt" DATETIME,
    "lossReviewedByAccountId" TEXT,
    "lossReviewedPositionId" TEXT,
    "lossReviewNote" TEXT,
    "evidenceFileId" TEXT,
    "cancelledAt" DATETIME,
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GaRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_verifiedByAccountId_fkey" FOREIGN KEY ("verifiedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_processedByAccountId_fkey" FOREIGN KEY ("processedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_lossReviewedByAccountId_fkey" FOREIGN KEY ("lossReviewedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_lossReviewedPositionId_fkey" FOREIGN KEY ("lossReviewedPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GaRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GaRequest" ("approvalRequired", "assetId", "createdAt", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "description", "evidenceFileId", "id", "locationId", "lossReviewNote", "lossReviewedAt", "lossReviewedByAccountId", "lossReviewedPositionId", "processedAt", "processedByAccountId", "procurementReference", "requestNumber", "requestType", "requesterEmployeeId", "resultingCustodyId", "status", "submittedAt", "submittedByAccountId", "urgency", "verificationNote", "verifiedAt", "verifiedByAccountId") SELECT "approvalRequired", "assetId", "createdAt", "decisionAt", "decisionByAccountId", "decisionNote", "decisionPositionId", "description", "evidenceFileId", "id", "locationId", "lossReviewNote", "lossReviewedAt", "lossReviewedByAccountId", "lossReviewedPositionId", "processedAt", "processedByAccountId", "procurementReference", "requestNumber", "requestType", "requesterEmployeeId", "resultingCustodyId", "status", "submittedAt", "submittedByAccountId", "urgency", "verificationNote", "verifiedAt", "verifiedByAccountId" FROM "GaRequest";
DROP TABLE "GaRequest";
ALTER TABLE "new_GaRequest" RENAME TO "GaRequest";
CREATE UNIQUE INDEX "GaRequest_requestNumber_key" ON "GaRequest"("requestNumber");
CREATE UNIQUE INDEX "GaRequest_evidenceFileId_key" ON "GaRequest"("evidenceFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


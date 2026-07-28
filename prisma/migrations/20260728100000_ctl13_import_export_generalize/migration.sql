-- Generalizes ImportRow.createdEmployeeId (Phase 0, Employee-only) into
-- createdRecordId (CTL-13: every dataset's importer, not just Employee),
-- and adds rowAction to record whether a committed row created or updated
-- a record. Existing values are copied across, not dropped.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "rowAction" TEXT,
    "createdRecordId" TEXT,
    CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportRow" ("id", "importBatchId", "isValid", "rawData", "rejectionReason", "rowNumber", "rowAction", "createdRecordId")
SELECT "id", "importBatchId", "isValid", "rawData", "rejectionReason", "rowNumber",
       CASE WHEN "createdEmployeeId" IS NOT NULL THEN 'CREATE' ELSE NULL END,
       "createdEmployeeId"
FROM "ImportRow";
DROP TABLE "ImportRow";
ALTER TABLE "new_ImportRow" RENAME TO "ImportRow";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

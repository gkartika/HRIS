
-- CreateTable
CREATE TABLE "GaRequest" (
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
    CONSTRAINT "GaRequest_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GaApprovalConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalType" TEXT NOT NULL,
    "approverPositionId" TEXT NOT NULL,
    "updatedByAccountId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GaApprovalConfig_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GaApprovalConfig_updatedByAccountId_fkey" FOREIGN KEY ("updatedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenancePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME,
    "intervalDays" INTEGER,
    "intervalKm" INTEGER,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenancePlan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenancePlan_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourcePlanId" TEXT,
    "sourceGaRequestId" TEXT,
    "workType" TEXT NOT NULL,
    "checklistNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceDate" DATETIME,
    "odometerKm" INTEGER,
    "diagnosisNote" TEXT,
    "actionTakenNote" TEXT,
    "cost" REAL,
    "evidenceFileId" TEXT,
    "outcome" TEXT,
    "nextDueDate" DATETIME,
    "nextDueKm" INTEGER,
    "completedByAccountId" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "MaintenanceWorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceWorkOrder_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceWorkOrder_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceWorkOrder_completedByAccountId_fkey" FOREIGN KEY ("completedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisposalCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceWorkOrderId" TEXT,
    "sourceGaRequestId" TEXT,
    "proposalNote" TEXT,
    "proposalEvidenceFileId" TEXT,
    "submittedForApprovalAt" DATETIME,
    "decisionAt" DATETIME,
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "executionMethod" TEXT,
    "executionDate" DATETIME,
    "executionValue" REAL,
    "executionReference" TEXT,
    "executionEvidenceFileId" TEXT,
    "executedByAccountId" TEXT,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisposalCase_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisposalCase_proposalEvidenceFileId_fkey" FOREIGN KEY ("proposalEvidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisposalCase_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisposalCase_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisposalCase_executionEvidenceFileId_fkey" FOREIGN KEY ("executionEvidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisposalCase_executedByAccountId_fkey" FOREIGN KEY ("executedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisposalCase_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GaRequest_requestNumber_key" ON "GaRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GaRequest_evidenceFileId_key" ON "GaRequest"("evidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "GaApprovalConfig_approvalType_key" ON "GaApprovalConfig"("approvalType");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_workOrderNumber_key" ON "MaintenanceWorkOrder"("workOrderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_evidenceFileId_key" ON "MaintenanceWorkOrder"("evidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "DisposalCase_caseNumber_key" ON "DisposalCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DisposalCase_proposalEvidenceFileId_key" ON "DisposalCase"("proposalEvidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "DisposalCase_executionEvidenceFileId_key" ON "DisposalCase"("executionEvidenceFileId");


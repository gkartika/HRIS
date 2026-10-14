-- Indexes for the lookups the simplified asset workflow runs on every request and every night.
CREATE INDEX "MaintenanceWorkOrder_assetId_status_idx" ON "MaintenanceWorkOrder"("assetId", "status");
CREATE INDEX "MaintenanceWorkOrder_sourcePlanId_status_idx" ON "MaintenanceWorkOrder"("sourcePlanId", "status");
CREATE INDEX "MaintenanceWorkOrder_sourceGaRequestId_idx" ON "MaintenanceWorkOrder"("sourceGaRequestId");
CREATE INDEX "DisposalCase_assetId_status_idx" ON "DisposalCase"("assetId", "status");
CREATE INDEX "MaintenancePlan_activeFlag_dueDate_idx" ON "MaintenancePlan"("activeFlag", "dueDate");

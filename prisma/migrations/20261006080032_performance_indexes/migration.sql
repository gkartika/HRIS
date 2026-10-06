-- DropIndex
DROP INDEX "AbsenceRequest_status_idx";

-- CreateIndex
CREATE INDEX "AbsenceRequest_status_startDate_idx" ON "AbsenceRequest"("status", "startDate");

-- CreateIndex
CREATE INDEX "AssetCustody_status_idx" ON "AssetCustody"("status");

-- CreateIndex
CREATE INDEX "AttendanceAssignment_employeeId_effectiveTo_idx" ON "AttendanceAssignment"("employeeId", "effectiveTo");

-- CreateIndex
CREATE INDEX "AttendanceEvent_eventSource_eventAt_idx" ON "AttendanceEvent"("eventSource", "eventAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_eventAt_idx" ON "AuditLog"("action", "eventAt");

-- CreateIndex
CREATE INDEX "ConsumableTransaction_itemId_type_cancelledAt_idx" ON "ConsumableTransaction"("itemId", "type", "cancelledAt");

-- CreateIndex
CREATE INDEX "FixedAsset_activeFlag_status_idx" ON "FixedAsset"("activeFlag", "status");

-- CreateIndex
CREATE INDEX "LearningAssignment_status_effectivenessRequiredSnapshot_eff_idx" ON "LearningAssignment"("status", "effectivenessRequiredSnapshot", "effectivenessCompletedAt");

-- CreateIndex
CREATE INDEX "OffboardingCase_status_clearanceDueDate_idx" ON "OffboardingCase"("status", "clearanceDueDate");

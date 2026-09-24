-- Backend cleanup: atomic case-number counter, indexes, and columns nothing reads or writes.

-- Case numbers (OFB-2026-0001 …) come from one atomic counter per series and year.
CREATE TABLE "NumberSequence" (
    "key" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("key")
);

-- Drop columns that no screen reads or writes (data in them was always empty).
ALTER TABLE "Job" DROP COLUMN "pdcaPlan", DROP COLUMN "pdcaDo", DROP COLUMN "pdcaCheck", DROP COLUMN "pdcaAct", DROP COLUMN "decisionAuthority", DROP COLUMN "keyCollaboration", DROP COLUMN "jobVersion";
ALTER TABLE "Evaluation" DROP COLUMN "cancelledReason";
ALTER TABLE "RecruitmentRequest" DROP COLUMN "requestedPositionId";
ALTER TABLE "MovementRequest" DROP COLUMN "performanceEvaluationFileId";
ALTER TABLE "Contract" DROP COLUMN "contractFileId";
ALTER TABLE "ImportBatch" DROP COLUMN "duplicateRows";
ALTER TABLE "CompetencyFrameworkVersion" DROP COLUMN "revision";
ALTER TABLE "CompanyValueFrameworkVersion" DROP COLUMN "revision";
ALTER TABLE "TrainingCourse" DROP COLUMN "actualCost";

-- Indexes on the columns that lists and lookups filter by.
CREATE INDEX "Evaluation_employeeId_idx" ON "Evaluation"("employeeId");
CREATE INDEX "Evaluation_status_idx" ON "Evaluation"("status");
CREATE INDEX "ContractRenewalCase_status_idx" ON "ContractRenewalCase"("status");
CREATE INDEX "OffboardingCase_employeeId_status_idx" ON "OffboardingCase"("employeeId", "status");
CREATE INDEX "Employee_currentPositionId_idx" ON "Employee"("currentPositionId");
CREATE INDEX "Employee_activeFlag_idx" ON "Employee"("activeFlag");
CREATE INDEX "OrgUnit_parentUnitId_idx" ON "OrgUnit"("parentUnitId");
CREATE INDEX "Position_orgUnitId_idx" ON "Position"("orgUnitId");
CREATE INDEX "Position_reportsToPositionId_idx" ON "Position"("reportsToPositionId");
CREATE INDEX "Position_jobId_idx" ON "Position"("jobId");
CREATE INDEX "Assignment_employeeId_status_idx" ON "Assignment"("employeeId", "status");
CREATE INDEX "Assignment_positionId_status_idx" ON "Assignment"("positionId", "status");
CREATE INDEX "RecruitmentRequest_status_idx" ON "RecruitmentRequest"("status");
CREATE INDEX "MovementRequest_employeeId_idx" ON "MovementRequest"("employeeId");
CREATE INDEX "MovementRequest_status_idx" ON "MovementRequest"("status");
CREATE INDEX "OnboardingCase_employeeId_idx" ON "OnboardingCase"("employeeId");
CREATE INDEX "Contract_employeeId_idx" ON "Contract"("employeeId");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
CREATE INDEX "AuditLog_datasetName_eventAt_idx" ON "AuditLog"("datasetName", "eventAt");
CREATE INDEX "AuditLog_actorAccountId_idx" ON "AuditLog"("actorAccountId");
CREATE INDEX "AuditLog_eventAt_idx" ON "AuditLog"("eventAt");
CREATE INDEX "ImportRow_importBatchId_idx" ON "ImportRow"("importBatchId");
CREATE INDEX "FileObject_employeeId_idx" ON "FileObject"("employeeId");
CREATE INDEX "AttendanceEvent_employeeId_eventAt_idx" ON "AttendanceEvent"("employeeId", "eventAt");
CREATE INDEX "DailyAttendanceRecord_attendanceDate_idx" ON "DailyAttendanceRecord"("attendanceDate");
CREATE INDEX "AbsenceRequest_employeeId_status_idx" ON "AbsenceRequest"("employeeId", "status");
CREATE INDEX "AbsenceRequest_status_idx" ON "AbsenceRequest"("status");
CREATE INDEX "CompetencyAssessment_employeeId_idx" ON "CompetencyAssessment"("employeeId");
CREATE INDEX "TrainingRequest_employeeId_idx" ON "TrainingRequest"("employeeId");
CREATE INDEX "TrainingRequest_status_idx" ON "TrainingRequest"("status");
CREATE INDEX "LearningAssignment_employeeId_status_idx" ON "LearningAssignment"("employeeId", "status");
CREATE INDEX "LearningAssignment_courseId_status_idx" ON "LearningAssignment"("courseId", "status");
CREATE INDEX "AssetCustody_employeeId_status_idx" ON "AssetCustody"("employeeId", "status");
CREATE INDEX "AssetCustody_assetId_idx" ON "AssetCustody"("assetId");
CREATE INDEX "GaRequest_requesterEmployeeId_idx" ON "GaRequest"("requesterEmployeeId");
CREATE INDEX "GaRequest_status_idx" ON "GaRequest"("status");
CREATE INDEX "MaintenanceWorkOrder_status_idx" ON "MaintenanceWorkOrder"("status");
CREATE INDEX "DisposalCase_status_idx" ON "DisposalCase"("status");

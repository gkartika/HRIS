-- CreateTable
CREATE TABLE "CompetencyFrameworkVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionLabel" TEXT NOT NULL,
    "sourceDocNumber" TEXT,
    "sourceDocDate" DATETIME,
    "revision" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompetencyDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "aliasesCsv" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompetencyDefinition_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "CompetencyFrameworkVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyLevelIndicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencyDefinitionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "indicatorText" TEXT NOT NULL,
    CONSTRAINT "CompetencyLevelIndicator_competencyDefinitionId_fkey" FOREIGN KEY ("competencyDefinitionId") REFERENCES "CompetencyDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyValueFrameworkVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionLabel" TEXT NOT NULL,
    "sourceDocNumber" TEXT,
    "sourceDocDate" DATETIME,
    "revision" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompanyValueDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 20,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompanyValueDefinition_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "CompanyValueFrameworkVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyValueRubricIndicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyValueDefinitionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "indicatorText" TEXT NOT NULL,
    CONSTRAINT "CompanyValueRubricIndicator_companyValueDefinitionId_fkey" FOREIGN KEY ("companyValueDefinitionId") REFERENCES "CompanyValueDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PositionCompetencyRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "competencyDefinitionId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "targetLevel" INTEGER,
    "updatedByAccountId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PositionCompetencyRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PositionCompetencyRequirement_competencyDefinitionId_fkey" FOREIGN KEY ("competencyDefinitionId") REFERENCES "CompetencyDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PositionCompetencyRequirement_updatedByAccountId_fkey" FOREIGN KEY ("updatedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyAssessmentCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleCode" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "cutoffDate" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "competencyFrameworkVersionId" TEXT NOT NULL,
    "companyValueFrameworkVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "openedByAccountId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "CompetencyAssessmentCycle_competencyFrameworkVersionId_fkey" FOREIGN KEY ("competencyFrameworkVersionId") REFERENCES "CompetencyFrameworkVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessmentCycle_companyValueFrameworkVersionId_fkey" FOREIGN KEY ("companyValueFrameworkVersionId") REFERENCES "CompanyValueFrameworkVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessmentCycle_openedByAccountId_fkey" FOREIGN KEY ("openedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "primaryAssignmentId" TEXT,
    "positionId" TEXT,
    "jobId" TEXT,
    "orgUnitId" TEXT,
    "isLevel3AtSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "p1EmployeeId" TEXT,
    "p1PositionId" TEXT,
    "p2EmployeeId" TEXT,
    "p2PositionId" TEXT,
    "p1SubmittedAt" DATETIME,
    "p2SubmittedAt" DATETIME,
    "competencyAchievementPct" REAL,
    "companyValuesScore" REAL,
    "completedAt" DATETIME,
    "isHistoricalMigration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetencyAssessment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CompetencyAssessmentCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_p1EmployeeId_fkey" FOREIGN KEY ("p1EmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_p1PositionId_fkey" FOREIGN KEY ("p1PositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_p2EmployeeId_fkey" FOREIGN KEY ("p2EmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessment_p2PositionId_fkey" FOREIGN KEY ("p2PositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyEvaluatorChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "oldEmployeeId" TEXT,
    "newEmployeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByAccountId" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetencyEvaluatorChange_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyEvaluatorChange_oldEmployeeId_fkey" FOREIGN KEY ("oldEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompetencyEvaluatorChange_newEmployeeId_fkey" FOREIGN KEY ("newEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyEvaluatorChange_changedByAccountId_fkey" FOREIGN KEY ("changedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyAssessmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "competencyDefinitionId" TEXT NOT NULL,
    "competencyNameSnapshot" TEXT NOT NULL,
    "categorySnapshot" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "requiredLevel" INTEGER,
    "actualLevel" INTEGER,
    "comment" TEXT,
    CONSTRAINT "CompetencyAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompetencyAssessmentItem_competencyDefinitionId_fkey" FOREIGN KEY ("competencyDefinitionId") REFERENCES "CompetencyDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyValueAssessmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "companyValueDefinitionId" TEXT NOT NULL,
    "valueNameSnapshot" TEXT NOT NULL,
    "weightSnapshot" INTEGER NOT NULL,
    "p1Score" INTEGER,
    "p1Comment" TEXT,
    "p2Score" INTEGER,
    "p2Comment" TEXT,
    CONSTRAINT "CompanyValueAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanyValueAssessmentItem_companyValueDefinitionId_fkey" FOREIGN KEY ("companyValueDefinitionId") REFERENCES "CompanyValueDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "provider" TEXT,
    "deliveryMethod" TEXT,
    "plannedCost" REAL,
    "actualCost" REAL,
    "certificateRequired" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessRequired" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessFollowupDays" INTEGER NOT NULL DEFAULT 30,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingCourse_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "location" TEXT,
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingSession_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "requesterType" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "submittedByAccountId" TEXT NOT NULL,
    "departmentIdSnapshot" TEXT,
    "positionIdSnapshot" TEXT,
    "reason" TEXT NOT NULL,
    "gapReferenceNote" TEXT,
    "requestedTopic" TEXT NOT NULL,
    "businessJustification" TEXT,
    "preferredTiming" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "deptHeadDecisionAt" DATETIME,
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadNote" TEXT,
    "trainingAdminDecisionAt" DATETIME,
    "trainingAdminDecisionByAccountId" TEXT,
    "trainingAdminNote" TEXT,
    "courseId" TEXT,
    "sessionId" TEXT,
    "cancelledAt" DATETIME,
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_departmentIdSnapshot_fkey" FOREIGN KEY ("departmentIdSnapshot") REFERENCES "OrgUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_positionIdSnapshot_fkey" FOREIGN KEY ("positionIdSnapshot") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_trainingAdminDecisionByAccountId_fkey" FOREIGN KEY ("trainingAdminDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceTrainingRequestId" TEXT,
    "sourceMandatoryRuleId" TEXT,
    "assignedByAccountId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "attendanceConfirmedAt" DATETIME,
    "completedAt" DATETIME,
    "certificateNumber" TEXT,
    "certificateIssueDate" DATETIME,
    "effectivenessRequiredSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessDueDate" DATETIME,
    "effectivenessCompletedAt" DATETIME,
    "effectivenessResult" TEXT,
    "effectivenessEvaluatorId" TEXT,
    "effectivenessEvidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_sourceTrainingRequestId_fkey" FOREIGN KEY ("sourceTrainingRequestId") REFERENCES "TrainingRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_sourceMandatoryRuleId_fkey" FOREIGN KEY ("sourceMandatoryRuleId") REFERENCES "MandatoryTrainingRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_effectivenessEvaluatorId_fkey" FOREIGN KEY ("effectivenessEvaluatorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MandatoryTrainingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetEmployeeId" TEXT,
    "targetDepartmentId" TEXT,
    "targetJobId" TEXT,
    "targetPositionId" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MandatoryTrainingRule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MandatoryTrainingRule_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MandatoryTrainingRule_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "OrgUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MandatoryTrainingRule_targetJobId_fkey" FOREIGN KEY ("targetJobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MandatoryTrainingRule_targetPositionId_fkey" FOREIGN KEY ("targetPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MandatoryTrainingRule_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyDefinition_frameworkVersionId_code_key" ON "CompetencyDefinition"("frameworkVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyLevelIndicator_competencyDefinitionId_level_key" ON "CompetencyLevelIndicator"("competencyDefinitionId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyValueDefinition_frameworkVersionId_code_key" ON "CompanyValueDefinition"("frameworkVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyValueRubricIndicator_companyValueDefinitionId_score_key" ON "CompanyValueRubricIndicator"("companyValueDefinitionId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "PositionCompetencyRequirement_jobId_competencyDefinitionId_key" ON "PositionCompetencyRequirement"("jobId", "competencyDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessmentCycle_cycleCode_key" ON "CompetencyAssessmentCycle"("cycleCode");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessment_cycleId_employeeId_key" ON "CompetencyAssessment"("cycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAssessmentItem_assessmentId_competencyDefinitionId_key" ON "CompetencyAssessmentItem"("assessmentId", "competencyDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyValueAssessmentItem_assessmentId_companyValueDefinitionId_key" ON "CompanyValueAssessmentItem"("assessmentId", "companyValueDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRequest_requestNumber_key" ON "TrainingRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAssignment_sourceTrainingRequestId_key" ON "LearningAssignment"("sourceTrainingRequestId");


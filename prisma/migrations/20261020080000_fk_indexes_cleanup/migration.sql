-- Indexes on foreign keys that are looked up from the parent side (a course's sessions, a quiz's questions, a request's fulfilments ...), and
-- the one index a unique constraint already covers. Nothing here changes data.

-- DropIndex
DROP INDEX "OnboardingCase_employeeId_idx";

-- CreateIndex
CREATE INDEX "AbsenceApproverConfig_approverPositionId_idx" ON "AbsenceApproverConfig"("approverPositionId");

-- CreateIndex
CREATE INDEX "AbsenceRequest_absenceTypeCode_idx" ON "AbsenceRequest"("absenceTypeCode");

-- CreateIndex
CREATE INDEX "AssetCustody_orgUnitId_idx" ON "AssetCustody"("orgUnitId");

-- CreateIndex
CREATE INDEX "AssetCustody_locationId_idx" ON "AssetCustody"("locationId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_attendanceAssignmentId_idx" ON "AttendanceEvent"("attendanceAssignmentId");

-- CreateIndex
CREATE INDEX "CompanyValueAssessmentItem_companyValueDefinitionId_idx" ON "CompanyValueAssessmentItem"("companyValueDefinitionId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_p1EmployeeId_idx" ON "CompetencyAssessment"("p1EmployeeId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_p2EmployeeId_idx" ON "CompetencyAssessment"("p2EmployeeId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_positionId_idx" ON "CompetencyAssessment"("positionId");

-- CreateIndex
CREATE INDEX "CompetencyAssessmentItem_competencyDefinitionId_idx" ON "CompetencyAssessmentItem"("competencyDefinitionId");

-- CreateIndex
CREATE INDEX "CompetencyEvaluatorChange_assessmentId_idx" ON "CompetencyEvaluatorChange"("assessmentId");

-- CreateIndex
CREATE INDEX "ContractRenewalCase_employeeId_idx" ON "ContractRenewalCase"("employeeId");

-- CreateIndex
CREATE INDEX "CourseMaterial_courseId_idx" ON "CourseMaterial"("courseId");

-- CreateIndex
CREATE INDEX "Evaluation_p1EmployeeId_idx" ON "Evaluation"("p1EmployeeId");

-- CreateIndex
CREATE INDEX "Evaluation_p2EmployeeId_idx" ON "Evaluation"("p2EmployeeId");

-- CreateIndex
CREATE INDEX "ExitClearanceAnswer_questionId_idx" ON "ExitClearanceAnswer"("questionId");

-- CreateIndex
CREATE INDEX "ExitClearanceSubmission_employeeId_idx" ON "ExitClearanceSubmission"("employeeId");

-- CreateIndex
CREATE INDEX "GaRequest_locationId_idx" ON "GaRequest"("locationId");

-- CreateIndex
CREATE INDEX "LearningAssignment_sessionId_idx" ON "LearningAssignment"("sessionId");

-- CreateIndex
CREATE INDEX "LearningAssignmentMaterialProgress_materialId_idx" ON "LearningAssignmentMaterialProgress"("materialId");

-- CreateIndex
CREATE INDEX "MandatoryTrainingRule_courseId_idx" ON "MandatoryTrainingRule"("courseId");

-- CreateIndex
CREATE INDEX "MovementRequest_requesterEmployeeId_idx" ON "MovementRequest"("requesterEmployeeId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttemptAnswer_questionId_idx" ON "QuizAttemptAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuizAttemptAnswer_optionId_idx" ON "QuizAttemptAnswer"("optionId");

-- CreateIndex
CREATE INDEX "QuizOption_questionId_idx" ON "QuizOption"("questionId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "RecruitmentRequest_departmentId_idx" ON "RecruitmentRequest"("departmentId");

-- CreateIndex
CREATE INDEX "RecruitmentRequest_jobId_idx" ON "RecruitmentRequest"("jobId");

-- CreateIndex
CREATE INDEX "RecruitmentRequest_requesterEmployeeId_idx" ON "RecruitmentRequest"("requesterEmployeeId");

-- CreateIndex
CREATE INDEX "RecruitmentRequestFulfillment_recruitmentRequestId_idx" ON "RecruitmentRequestFulfillment"("recruitmentRequestId");

-- CreateIndex
CREATE INDEX "TaskForceMembership_employeeId_idx" ON "TaskForceMembership"("employeeId");

-- CreateIndex
CREATE INDEX "TrainingRequest_courseId_idx" ON "TrainingRequest"("courseId");

-- CreateIndex
CREATE INDEX "TrainingRequest_sessionId_idx" ON "TrainingRequest"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingSession_courseId_idx" ON "TrainingSession"("courseId");


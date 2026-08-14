-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "fileId" TEXT,
    "externalUrl" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseMaterial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningAssignmentMaterialProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learningAssignmentId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningAssignmentMaterialProgress_learningAssignmentId_fkey" FOREIGN KEY ("learningAssignmentId") REFERENCES "LearningAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignmentMaterialProgress_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "passingScorePercent" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learningAssignmentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "scorePercent" REAL,
    "passed" BOOLEAN,
    CONSTRAINT "QuizAttempt_learningAssignmentId_fkey" FOREIGN KEY ("learningAssignmentId") REFERENCES "LearningAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttemptAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    CONSTRAINT "QuizAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttemptAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuizOption" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LearningAssignment" (
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
    "certificateExpiryDate" DATETIME,
    "certificateFileId" TEXT,
    "attendanceEvidenceNote" TEXT,
    "attendanceEvidenceFileId" TEXT,
    "quizBonusAttempts" INTEGER NOT NULL DEFAULT 0,
    "overrideReason" TEXT,
    CONSTRAINT "LearningAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_sourceTrainingRequestId_fkey" FOREIGN KEY ("sourceTrainingRequestId") REFERENCES "TrainingRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_sourceMandatoryRuleId_fkey" FOREIGN KEY ("sourceMandatoryRuleId") REFERENCES "MandatoryTrainingRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_effectivenessEvaluatorId_fkey" FOREIGN KEY ("effectivenessEvaluatorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_certificateFileId_fkey" FOREIGN KEY ("certificateFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LearningAssignment_attendanceEvidenceFileId_fkey" FOREIGN KEY ("attendanceEvidenceFileId") REFERENCES "FileObject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LearningAssignment" ("assignedAt", "assignedByAccountId", "attendanceConfirmedAt", "certificateIssueDate", "certificateNumber", "completedAt", "courseId", "createdAt", "effectivenessCompletedAt", "effectivenessDueDate", "effectivenessEvaluatorId", "effectivenessEvidence", "effectivenessRequiredSnapshot", "effectivenessResult", "employeeId", "id", "sessionId", "sourceMandatoryRuleId", "sourceTrainingRequestId", "sourceType", "status") SELECT "assignedAt", "assignedByAccountId", "attendanceConfirmedAt", "certificateIssueDate", "certificateNumber", "completedAt", "courseId", "createdAt", "effectivenessCompletedAt", "effectivenessDueDate", "effectivenessEvaluatorId", "effectivenessEvidence", "effectivenessRequiredSnapshot", "effectivenessResult", "employeeId", "id", "sessionId", "sourceMandatoryRuleId", "sourceTrainingRequestId", "sourceType", "status" FROM "LearningAssignment";
DROP TABLE "LearningAssignment";
ALTER TABLE "new_LearningAssignment" RENAME TO "LearningAssignment";
CREATE UNIQUE INDEX "LearningAssignment_sourceTrainingRequestId_key" ON "LearningAssignment"("sourceTrainingRequestId");
CREATE UNIQUE INDEX "LearningAssignment_certificateFileId_key" ON "LearningAssignment"("certificateFileId");
CREATE UNIQUE INDEX "LearningAssignment_attendanceEvidenceFileId_key" ON "LearningAssignment"("attendanceEvidenceFileId");
CREATE TABLE "new_TrainingCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "provider" TEXT,
    "deliveryMethod" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "objectives" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
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
INSERT INTO "new_TrainingCourse" ("activeFlag", "actualCost", "category", "certificateRequired", "createdAt", "createdByAccountId", "deliveryMethod", "effectivenessFollowupDays", "effectivenessRequired", "id", "plannedCost", "provider", "title") SELECT "activeFlag", "actualCost", "category", "certificateRequired", "createdAt", "createdByAccountId", "deliveryMethod", "effectivenessFollowupDays", "effectivenessRequired", "id", "plannedCost", "provider", "title" FROM "TrainingCourse";
DROP TABLE "TrainingCourse";
ALTER TABLE "new_TrainingCourse" RENAME TO "TrainingCourse";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CourseMaterial_fileId_key" ON "CourseMaterial"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAssignmentMaterialProgress_learningAssignmentId_materialId_key" ON "LearningAssignmentMaterialProgress"("learningAssignmentId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_courseId_key" ON "Quiz"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_learningAssignmentId_attemptNumber_key" ON "QuizAttempt"("learningAssignmentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttemptAnswer_attemptId_questionId_optionId_key" ON "QuizAttemptAnswer"("attemptId", "questionId", "optionId");


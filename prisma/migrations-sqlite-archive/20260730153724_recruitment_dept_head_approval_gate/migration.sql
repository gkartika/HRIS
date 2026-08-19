-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecruitmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "requestDate" DATETIME NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "jobId" TEXT,
    "requestedPositionId" TEXT,
    "shiftCode" TEXT NOT NULL,
    "requestedHeadcount" INTEGER NOT NULL,
    "jobDescriptionSnapshot" TEXT NOT NULL,
    "educationRequirementCode" TEXT NOT NULL,
    "workExperienceBand" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "genderRequirement" TEXT,
    "requestedJobLevel" TEXT NOT NULL,
    "specialCriteria" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requesterEmployeeId" TEXT NOT NULL,
    "requesterPositionId" TEXT,
    "submittedAt" DATETIME,
    "submittedByAccountId" TEXT,
    "deptHeadDecisionAt" DATETIME,
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadDecisionNote" TEXT,
    "approvedAt" DATETIME,
    "approvedByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "cancelledAt" DATETIME,
    "cancelledByAccountId" TEXT,
    "cancelledByEmployeeId" TEXT,
    "cancellationAuthority" TEXT,
    "cancellationReason" TEXT,
    "previousStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecruitmentRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_requestedPositionId_fkey" FOREIGN KEY ("requestedPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_requesterPositionId_fkey" FOREIGN KEY ("requesterPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_approvedByAccountId_fkey" FOREIGN KEY ("approvedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_cancelledByEmployeeId_fkey" FOREIGN KEY ("cancelledByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecruitmentRequest" ("ageBand", "approvedAt", "approvedByAccountId", "cancellationAuthority", "cancellationReason", "cancelledAt", "cancelledByAccountId", "cancelledByEmployeeId", "createdAt", "decisionNote", "decisionPositionId", "departmentId", "educationRequirementCode", "genderRequirement", "id", "jobDescriptionSnapshot", "jobId", "previousStatus", "reasonCode", "requestDate", "requestNumber", "requestedHeadcount", "requestedJobLevel", "requestedPositionId", "requesterEmployeeId", "requesterPositionId", "shiftCode", "specialCriteria", "status", "submittedAt", "submittedByAccountId", "updatedAt", "workExperienceBand") SELECT "ageBand", "approvedAt", "approvedByAccountId", "cancellationAuthority", "cancellationReason", "cancelledAt", "cancelledByAccountId", "cancelledByEmployeeId", "createdAt", "decisionNote", "decisionPositionId", "departmentId", "educationRequirementCode", "genderRequirement", "id", "jobDescriptionSnapshot", "jobId", "previousStatus", "reasonCode", "requestDate", "requestNumber", "requestedHeadcount", "requestedJobLevel", "requestedPositionId", "requesterEmployeeId", "requesterPositionId", "shiftCode", "specialCriteria", "status", "submittedAt", "submittedByAccountId", "updatedAt", "workExperienceBand" FROM "RecruitmentRequest";
DROP TABLE "RecruitmentRequest";
ALTER TABLE "new_RecruitmentRequest" RENAME TO "RecruitmentRequest";
CREATE UNIQUE INDEX "RecruitmentRequest_requestNumber_key" ON "RecruitmentRequest"("requestNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

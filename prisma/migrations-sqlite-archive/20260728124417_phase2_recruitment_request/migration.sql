-- CreateTable
CREATE TABLE "RecruitmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "requestDate" DATETIME NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
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
    "approvedAt" DATETIME,
    "approvedByAccountId" TEXT,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecruitmentRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_requestedPositionId_fkey" FOREIGN KEY ("requestedPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_requesterPositionId_fkey" FOREIGN KEY ("requesterPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequest_approvedByAccountId_fkey" FOREIGN KEY ("approvedByAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecruitmentRequestFulfillment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recruitmentRequestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedByAccountId" TEXT NOT NULL,
    CONSTRAINT "RecruitmentRequestFulfillment_recruitmentRequestId_fkey" FOREIGN KEY ("recruitmentRequestId") REFERENCES "RecruitmentRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequestFulfillment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequestFulfillment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequestFulfillment_linkedByAccountId_fkey" FOREIGN KEY ("linkedByAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequest_requestNumber_key" ON "RecruitmentRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequestFulfillment_employeeId_key" ON "RecruitmentRequestFulfillment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequestFulfillment_assignmentId_key" ON "RecruitmentRequestFulfillment"("assignmentId");

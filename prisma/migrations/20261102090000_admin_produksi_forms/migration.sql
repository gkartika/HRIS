-- Admin Produksi: a new login role and the three Production forms (Tambahan jam kerja, Izin meninggalkan pekerjaan,
-- Surat Peringatan) with their history. Additive only: one enum value, five enums, five tables, no change to existing data.
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'PRODUCTION_ADMIN';

CREATE TYPE "ProductionFormStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LEADER_APPROVED', 'COMPLETED', 'REJECTED', 'RETURNED', 'CANCELLED');
CREATE TYPE "ProductionFormKind" AS ENUM ('EXTRA_WORK', 'LEAVE_WORK', 'DISCIPLINE');
CREATE TYPE "ExtraWorkUnit" AS ENUM ('HOURS', 'WORKDAYS');
CREATE TYPE "LeaveWorkDecision" AS ENUM ('HALF_DAY', 'FULL_DAY');
CREATE TYPE "DisciplineKind" AS ENUM ('WARNING', 'SP1', 'SP2', 'SP3');

CREATE TABLE "ExtraWorkRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "unit" "ExtraWorkUnit" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ProductionFormStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT NOT NULL,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "leaderDecidedAt" TIMESTAMP(3),
    "leaderDecidedByName" TEXT,
    "leaderDecidedByEmployeeId" TEXT,
    "leaderNote" TEXT,
    "payrollDecidedAt" TIMESTAMP(3),
    "payrollDecidedByAccountId" TEXT,
    "payrollNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraWorkRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtraWorkLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "requestedAmount" DECIMAL(6,2) NOT NULL,
    "finalAmount" DECIMAL(6,2),

    CONSTRAINT "ExtraWorkLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveWorkRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "leaveTime" TEXT NOT NULL,
    "returnTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ProductionFormStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT NOT NULL,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "leaderDecidedAt" TIMESTAMP(3),
    "leaderDecidedByName" TEXT,
    "leaderDecidedByEmployeeId" TEXT,
    "leaderNote" TEXT,
    "decision" "LeaveWorkDecision",
    "decidedAt" TIMESTAMP(3),
    "decidedByAccountId" TEXT,
    "decisionNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveWorkRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryAction" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "DisciplineKind" NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProductionFormStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT NOT NULL,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "leaderDecidedAt" TIMESTAMP(3),
    "leaderDecidedByName" TEXT,
    "leaderDecidedByEmployeeId" TEXT,
    "leaderNote" TEXT,
    "handedOverAt" TIMESTAMP(3),
    "handedOverByAccountId" TEXT,
    "validUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionFormEvent" (
    "id" TEXT NOT NULL,
    "formKind" "ProductionFormKind" NOT NULL,
    "formId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionFormEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtraWorkRequest_requestNumber_key" ON "ExtraWorkRequest"("requestNumber");
CREATE INDEX "ExtraWorkRequest_status_idx" ON "ExtraWorkRequest"("status");
CREATE INDEX "ExtraWorkRequest_workDate_idx" ON "ExtraWorkRequest"("workDate");
CREATE INDEX "ExtraWorkRequest_departmentId_status_idx" ON "ExtraWorkRequest"("departmentId", "status");

CREATE UNIQUE INDEX "ExtraWorkLine_requestId_employeeId_key" ON "ExtraWorkLine"("requestId", "employeeId");
CREATE INDEX "ExtraWorkLine_employeeId_idx" ON "ExtraWorkLine"("employeeId");

CREATE UNIQUE INDEX "LeaveWorkRequest_requestNumber_key" ON "LeaveWorkRequest"("requestNumber");
CREATE INDEX "LeaveWorkRequest_status_idx" ON "LeaveWorkRequest"("status");
CREATE INDEX "LeaveWorkRequest_workDate_idx" ON "LeaveWorkRequest"("workDate");
CREATE INDEX "LeaveWorkRequest_employeeId_workDate_idx" ON "LeaveWorkRequest"("employeeId", "workDate");
CREATE INDEX "LeaveWorkRequest_departmentId_status_idx" ON "LeaveWorkRequest"("departmentId", "status");

CREATE UNIQUE INDEX "DisciplinaryAction_requestNumber_key" ON "DisciplinaryAction"("requestNumber");
CREATE INDEX "DisciplinaryAction_status_idx" ON "DisciplinaryAction"("status");
CREATE INDEX "DisciplinaryAction_employeeId_validUntil_idx" ON "DisciplinaryAction"("employeeId", "validUntil");
CREATE INDEX "DisciplinaryAction_departmentId_status_idx" ON "DisciplinaryAction"("departmentId", "status");

CREATE INDEX "ProductionFormEvent_formKind_formId_idx" ON "ProductionFormEvent"("formKind", "formId");

ALTER TABLE "ExtraWorkLine" ADD CONSTRAINT "ExtraWorkLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExtraWorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtraWorkLine" ADD CONSTRAINT "ExtraWorkLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveWorkRequest" ADD CONSTRAINT "LeaveWorkRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryAction" ADD CONSTRAINT "DisciplinaryAction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

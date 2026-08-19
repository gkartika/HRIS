-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('EMPLOYEE_LOGIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminScope" AS ENUM ('PEOPLE_PAYROLL', 'TRAINING', 'ASSETS', 'NONE');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('HR_ADMIN', 'TRAINING_ADMIN', 'GA_ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PKWTT', 'PKWT', 'HARIAN_LEPAS', 'MAGANG');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('DEPARTMENT', 'SECTION', 'GROUP', 'TEAM');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('STAFF', 'TEAM_LEAD', 'SECTION_HEAD', 'DEPARTMENT_HEAD', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('PLANNED', 'VACANT', 'FILLED', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PRIMARY', 'ADDITIONAL', 'ACTING', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('INTERNAL', 'RESTRICTED', 'HIGHLY_RESTRICTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'NEEDS_FIX', 'POSTED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "OnboardingOverallStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "CancellationAuthority" AS ENUM ('REQUESTER', 'HR_MANAGER', 'HR_ADMIN');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'RELEASED', 'SIGNED', 'ACTIVE', 'REVIEW_REQUESTED', 'RECOMMENDATION_SUBMITTED', 'APPROVED_FOR_RENEWAL', 'NOT_RENEWED', 'ENDED');

-- CreateEnum
CREATE TYPE "ContractRenewalRecommendation" AS ENUM ('RENEW', 'NOT_RENEW');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'IMPORT', 'EXPORT', 'PRINT', 'RELEASE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT');

-- CreateEnum
CREATE TYPE "RecruitmentReasonCode" AS ENUM ('REPLACEMENT', 'ADDITIONAL', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "ShiftCode" AS ENUM ('SHIFT', 'NON_SHIFT');

-- CreateEnum
CREATE TYPE "EducationRequirementCode" AS ENUM ('S1_UNIVERSITY', 'D1_D3_ACADEMY', 'SMA');

-- CreateEnum
CREATE TYPE "WorkExperienceBand" AS ENUM ('NONE', 'ONE_TO_TWO', 'THREE_TO_FOUR', 'MORE_THAN_FIVE');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('AGE_18_25', 'AGE_26_35', 'AGE_36_45');

-- CreateEnum
CREATE TYPE "RequestedJobLevel" AS ENUM ('DEPARTMENT_HEAD', 'SECTION_HEAD', 'SUPERVISOR', 'STAFF_OPERATOR', 'HARIAN_LEPAS');

-- CreateEnum
CREATE TYPE "RecruitmentRequestStatus" AS ENUM ('DRAFT', 'PENDING_DEPT_HEAD', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'RECRUITMENT_IN_PROGRESS', 'PARTIALLY_FILLED', 'FILLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PROMOTION', 'ROTATION', 'MUTATION', 'DEMOTION', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "MovementRequestStatus" AS ENUM ('PENDING_DEPT_HEAD', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED', 'IMPLEMENTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RenewalRecommendation" AS ENUM ('PERPANJANG_3', 'PERPANJANG_6', 'PERPANJANG_12', 'TIDAK_DIPERPANJANG', 'MUTASI', 'DEMOSI');

-- CreateEnum
CREATE TYPE "ContractRenewalCaseStatus" AS ENUM ('TRIGGERED', 'EVALUATION_SENT', 'PENDING_HR_MANAGER', 'RETURNED', 'REJECTED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvaluationPurpose" AS ENUM ('CONTRACT_RENEWAL', 'PROMOTION', 'MUTATION', 'DEMOTION', 'MANUAL_HR');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'RELEASED', 'COMPLETED', 'RETURNED', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "OffboardingReason" AS ENUM ('RESIGNATION', 'CONTRACT_NON_RENEWAL');

-- CreateEnum
CREATE TYPE "OffboardingCaseStatus" AS ENUM ('PENDING_DEPT_HEAD', 'PENDING_HR_MANAGER', 'PENDING_CLEARANCE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftAssignmentType" AS ENUM ('SHIFT_1', 'SHIFT_2', 'SHIFT_3', 'NON_SHIFT');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MOBILE', 'FINGERPRINT');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MOBILE', 'FINGERPRINT_IMPORT');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('CUTI', 'IZIN', 'SAKIT', 'LAINNYA');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('SUBMITTED', 'PENDING_HR_ADMIN', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompetencyCategory" AS ENUM ('GENERAL', 'WORK', 'LEADERSHIP');

-- CreateEnum
CREATE TYPE "FrameworkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvaluatorSlot" AS ENUM ('P1', 'P2');

-- CreateEnum
CREATE TYPE "TrainingRequesterType" AS ENUM ('SELF', 'LEVEL_3');

-- CreateEnum
CREATE TYPE "TrainingRequestStatus" AS ENUM ('SUBMITTED', 'DEPT_HEAD_APPROVED', 'REJECTED', 'VALIDATED', 'SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LearningAssignmentSourceType" AS ENUM ('TRAINING_REQUEST', 'MANDATORY_RULE');

-- CreateEnum
CREATE TYPE "LearningAssignmentStatus" AS ENUM ('ASSIGNED', 'ATTENDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EffectivenessResult" AS ENUM ('EFFECTIVE', 'NOT_EFFECTIVE');

-- CreateEnum
CREATE TYPE "MandatoryTargetType" AS ENUM ('EMPLOYEE', 'DEPARTMENT', 'JOB', 'PRIMARY_POSITION', 'EVERYONE');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseDeliveryMode" AS ENUM ('ONLINE', 'IN_PERSON', 'BLENDED');

-- CreateEnum
CREATE TYPE "CourseMaterialType" AS ENUM ('PDF', 'DOCX', 'PPTX', 'VIDEO', 'URL');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "AssetTrackingType" AS ENUM ('INDIVIDUAL', 'QUANTITY_TRACKED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'UNDER_REPAIR', 'DISPOSED', 'LOST_PENDING_REVIEW', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetCustodyTargetType" AS ENUM ('EMPLOYEE', 'DEPARTMENT', 'LOCATION');

-- CreateEnum
CREATE TYPE "AssetCustodyStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateEnum
CREATE TYPE "AssetInspectionResult" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'LOST_OR_BEYOND_REPAIR');

-- CreateEnum
CREATE TYPE "GaRequestType" AS ENUM ('NEW_ASSET_NEED', 'DAMAGE_OR_ABNORMAL_CONDITION', 'LOSS');

-- CreateEnum
CREATE TYPE "GaRequestUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "GaRequestStatus" AS ENUM ('SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSED', 'WORK_ORDER_CREATED', 'PENDING_LOSS_REVIEW', 'LOSS_CONFIRMED', 'LOSS_NOT_CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GaApprovalType" AS ENUM ('NEW_ASSET_NEED', 'LOSS_REVIEW', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "MaintenanceSourceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "MaintenanceWorkType" AS ENUM ('INTERNAL', 'VENDOR');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MaintenanceOutcome" AS ENUM ('OPERATIONAL', 'BEYOND_REPAIR');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('BEYOND_REPAIR', 'OBSOLETE', 'CONFIRMED_LOSS');

-- CreateEnum
CREATE TYPE "DisposalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "DisposalMethod" AS ENUM ('RETIRE', 'DISPOSE', 'SELL_AS_SCRAP');

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "evaluationNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "purpose" "EvaluationPurpose" NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryAssignmentId" TEXT,
    "snapshotPositionId" TEXT,
    "createdByAccountId" TEXT,
    "draftCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleHrAdminAccountId" TEXT,
    "releasedByAccountId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "evaluationDueDate" TIMESTAMP(3),
    "attendanceSakit" INTEGER,
    "attendanceIjin" INTEGER,
    "attendanceAlpha" INTEGER,
    "attendanceIjinHalfDay" INTEGER,
    "p1EmployeeId" TEXT,
    "p1PositionId" TEXT,
    "p1SubmittedAt" TIMESTAMP(3),
    "p1Scores" JSONB,
    "p1Total" INTEGER,
    "p2EmployeeId" TEXT,
    "p2PositionId" TEXT,
    "p2SubmittedAt" TIMESTAMP(3),
    "p2Scores" JSONB,
    "p2Total" INTEGER,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractRenewalCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "currentContractId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "primaryAssignmentId" TEXT NOT NULL,
    "snapshotPositionId" TEXT NOT NULL,
    "status" "ContractRenewalCaseStatus" NOT NULL DEFAULT 'TRIGGERED',
    "triggerDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluationId" TEXT,
    "deptHeadEmployeeId" TEXT,
    "deptHeadPositionId" TEXT,
    "deptHeadRecommendedAt" TIMESTAMP(3),
    "deptHeadRecommendation" "RenewalRecommendation",
    "deptHeadProposedDurationMonths" INTEGER,
    "deptHeadProposedPositionId" TEXT,
    "deptHeadNote" TEXT,
    "linkedMovementRequestId" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "finalRecommendation" "RenewalRecommendation",
    "changeReason" TEXT,
    "decisionNote" TEXT,
    "generatedContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractRenewalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" "OffboardingReason" NOT NULL,
    "status" "OffboardingCaseStatus" NOT NULL DEFAULT 'PENDING_HR_MANAGER',
    "lastWorkingDay" TIMESTAMP(3) NOT NULL,
    "clearanceDueDate" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedByAccountId" TEXT,
    "managerNote" TEXT,
    "sourceRenewalCaseId" TEXT,
    "deptHeadDecisionAt" TIMESTAMP(3),
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadNote" TEXT,
    "hrManagerDecisionAt" TIMESTAMP(3),
    "hrManagerDecisionByAccountId" TEXT,
    "hrManagerDecisionPositionId" TEXT,
    "hrManagerNote" TEXT,
    "clearanceCompletedAt" TIMESTAMP(3),
    "clearanceCompletedByAccountId" TEXT,
    "clearanceNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftAssignmentType" NOT NULL,
    "note" TEXT,
    "isHrOverride" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "submittedByPositionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "usernameOrEmail" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "employeeId" TEXT,
    "adminScope" "AdminScope" NOT NULL DEFAULT 'NONE',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "accountDisabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRole" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,

    CONSTRAINT "AccountRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "fullLegalName" TEXT NOT NULL,
    "nationalIdNumber" TEXT,
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender",
    "personalEmail" TEXT,
    "workEmail" TEXT,
    "mobileNumber" TEXT,
    "currentAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelation" TEXT,
    "emergencyContactPhone" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "taxId" TEXT,
    "bpjsEmploymentNumber" TEXT,
    "bpjsHealthNumber" TEXT,
    "noKk" TEXT,
    "namaIbuKandung" TEXT,
    "educationLevelId" TEXT,
    "ptkpStatusCode" TEXT,
    "ktpFileId" TEXT,
    "kkFileId" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL,
    "currentPositionId" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationLevel" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PtkpStatus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PtkpStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "unitType" "UnitType" NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "parentUnitId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobCode" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobPurpose" TEXT,
    "pdcaPlan" TEXT,
    "pdcaDo" TEXT,
    "pdcaCheck" TEXT,
    "pdcaAct" TEXT,
    "decisionAuthority" TEXT,
    "keyCollaboration" TEXT,
    "jobVersion" INTEGER NOT NULL DEFAULT 1,
    "approvalStatus" TEXT NOT NULL DEFAULT 'Approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "positionCode" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobLevel" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "approvedFte" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "positionStatus" "PositionStatus" NOT NULL DEFAULT 'VACANT',
    "grantsHrManagerAccess" BOOLEAN NOT NULL DEFAULT false,
    "reportsToPositionId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "assignmentType" "AssignmentType" NOT NULL,
    "primaryAssignmentFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "reasonCode" "RecruitmentReasonCode" NOT NULL,
    "departmentId" TEXT NOT NULL,
    "jobId" TEXT,
    "requestedPositionId" TEXT,
    "shiftCode" "ShiftCode" NOT NULL,
    "requestedHeadcount" INTEGER NOT NULL,
    "jobDescriptionSnapshot" TEXT NOT NULL,
    "educationRequirementCode" "EducationRequirementCode" NOT NULL,
    "workExperienceBand" "WorkExperienceBand" NOT NULL,
    "ageBand" "AgeBand" NOT NULL,
    "genderRequirement" "Gender",
    "requestedJobLevel" "RequestedJobLevel" NOT NULL,
    "specialCriteria" TEXT,
    "status" "RecruitmentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requesterEmployeeId" TEXT NOT NULL,
    "requesterPositionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedByAccountId" TEXT,
    "deptHeadDecisionAt" TIMESTAMP(3),
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadDecisionNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancelledByEmployeeId" TEXT,
    "cancellationAuthority" "CancellationAuthority",
    "cancellationReason" TEXT,
    "previousStatus" "RecruitmentRequestStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentRequestFulfillment" (
    "id" TEXT NOT NULL,
    "recruitmentRequestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedByAccountId" TEXT NOT NULL,

    CONSTRAINT "RecruitmentRequestFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "currentPositionId" TEXT NOT NULL,
    "currentAssignmentId" TEXT,
    "proposedPositionId" TEXT NOT NULL,
    "proposedEmploymentStatus" "EmploymentStatus",
    "proposedEffectiveDate" TIMESTAMP(3) NOT NULL,
    "requestReason" TEXT NOT NULL,
    "status" "MovementRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requesterEmployeeId" TEXT NOT NULL,
    "requesterPositionId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "deptHeadDecisionAt" TIMESTAMP(3),
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadDecisionNote" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "attendanceAlpha" INTEGER,
    "attendanceSakit" INTEGER,
    "attendanceIjin" INTEGER,
    "attendanceIjinHalfDay" INTEGER,
    "attendanceCuti" INTEGER,
    "performanceEvaluationRef" TEXT,
    "performanceEvaluationFileId" TEXT,
    "hrConfidentialNotes" TEXT,
    "evaluationId" TEXT,
    "implementedAt" TIMESTAMP(3),
    "implementedByAccountId" TEXT,
    "implementedAssignmentId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancelledByEmployeeId" TEXT,
    "cancellationAuthority" "CancellationAuthority",
    "cancellationReason" TEXT,
    "previousStatus" "MovementRequestStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "contractComplete" BOOLEAN NOT NULL DEFAULT false,
    "contractCompletedAt" TIMESTAMP(3),
    "contractCompletedByAccountId" TEXT,
    "mandatoryMaterialDueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractType" "EmploymentStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryAssignmentId" TEXT,
    "renewedFromContractId" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "recommendationSubmittedAt" TIMESTAMP(3),
    "recommendationByEmployeeId" TEXT,
    "recommendationByPositionId" TEXT,
    "recommendation" "ContractRenewalRecommendation",
    "recommendationNote" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "notRenewedReason" TEXT,
    "draftedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releasedByAccountId" TEXT,
    "releasedByPositionId" TEXT,
    "signedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "contractFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorAccountId" TEXT,
    "action" "AuditAction" NOT NULL,
    "datasetName" TEXT NOT NULL,
    "recordId" TEXT,
    "fieldName" TEXT,
    "oldValueMasked" TEXT,
    "newValueMasked" TEXT,
    "reason" TEXT,
    "sessionOrDeviceId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "uploadedByAccountId" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "importStatus" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "previewConfirmedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "rowAction" TEXT,
    "createdRecordId" TEXT,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sensitivity" "Sensitivity" NOT NULL DEFAULT 'RESTRICTED',
    "employeeId" TEXT,
    "uploadedByAccountId" TEXT NOT NULL,
    "category" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "confidential" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceGeofence" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceGeofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "geofenceId" TEXT,
    "fingerprintDeviceUserId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceAssignmentId" TEXT,
    "eventType" "AttendanceEventType" NOT NULL,
    "eventSource" "AttendanceSource" NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geofenceId" TEXT,
    "selfieFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "checkInEventId" TEXT,
    "checkOutEventId" TEXT,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceApproverConfig" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "approverPositionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceApproverConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceEntitlementConfig" (
    "id" TEXT NOT NULL,
    "absenceType" "AbsenceType" NOT NULL,
    "annualDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceEntitlementConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceType" "AbsenceType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentFileId" TEXT,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByAccountId" TEXT NOT NULL,
    "firstApproverPositionId" TEXT,
    "firstDecisionAt" TIMESTAMP(3),
    "firstDecisionByAccountId" TEXT,
    "firstDecisionNote" TEXT,
    "hrAdminDecisionAt" TIMESTAMP(3),
    "hrAdminDecisionByAccountId" TEXT,
    "hrAdminDecisionNote" TEXT,
    "isHrOverride" BOOLEAN NOT NULL DEFAULT false,
    "hrOverrideReason" TEXT,
    "hrOverrideAt" TIMESTAMP(3),
    "hrOverrideByAccountId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyFrameworkVersion" (
    "id" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "sourceDocNumber" TEXT,
    "sourceDocDate" TIMESTAMP(3),
    "revision" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "FrameworkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyFrameworkVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyDefinition" (
    "id" TEXT NOT NULL,
    "frameworkVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "CompetencyCategory" NOT NULL,
    "subcategory" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "aliasesCsv" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetencyDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyLevelIndicator" (
    "id" TEXT NOT NULL,
    "competencyDefinitionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "indicatorText" TEXT NOT NULL,

    CONSTRAINT "CompetencyLevelIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyValueFrameworkVersion" (
    "id" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "sourceDocNumber" TEXT,
    "sourceDocDate" TIMESTAMP(3),
    "revision" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "FrameworkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyValueFrameworkVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyValueDefinition" (
    "id" TEXT NOT NULL,
    "frameworkVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 20,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanyValueDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyValueRubricIndicator" (
    "id" TEXT NOT NULL,
    "companyValueDefinitionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "indicatorText" TEXT NOT NULL,

    CONSTRAINT "CompanyValueRubricIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionCompetencyRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "competencyDefinitionId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "targetLevel" INTEGER,
    "updatedByAccountId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionCompetencyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAssessmentCycle" (
    "id" TEXT NOT NULL,
    "cycleCode" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "competencyFrameworkVersionId" TEXT NOT NULL,
    "companyValueFrameworkVersionId" TEXT NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "openedByAccountId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CompetencyAssessmentCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAssessment" (
    "id" TEXT NOT NULL,
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
    "p1SubmittedAt" TIMESTAMP(3),
    "p2SubmittedAt" TIMESTAMP(3),
    "competencyAchievementPct" DOUBLE PRECISION,
    "companyValuesScore" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "isHistoricalMigration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyEvaluatorChange" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "slot" "EvaluatorSlot" NOT NULL,
    "oldEmployeeId" TEXT,
    "newEmployeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByAccountId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyEvaluatorChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "competencyDefinitionId" TEXT NOT NULL,
    "competencyNameSnapshot" TEXT NOT NULL,
    "categorySnapshot" "CompetencyCategory" NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "requiredLevel" INTEGER,
    "actualLevel" INTEGER,
    "comment" TEXT,

    CONSTRAINT "CompetencyAssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyValueAssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "companyValueDefinitionId" TEXT NOT NULL,
    "valueNameSnapshot" TEXT NOT NULL,
    "weightSnapshot" INTEGER NOT NULL,
    "p1Score" INTEGER,
    "p1Comment" TEXT,
    "p2Score" INTEGER,
    "p2Comment" TEXT,

    CONSTRAINT "CompanyValueAssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "provider" TEXT,
    "deliveryMethod" TEXT,
    "mode" "CourseDeliveryMode" NOT NULL DEFAULT 'ONLINE',
    "objectives" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "isOnboardingRequired" BOOLEAN NOT NULL DEFAULT false,
    "plannedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "certificateRequired" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessRequired" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessFollowupDays" INTEGER NOT NULL DEFAULT 30,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "capacity" INTEGER,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requesterType" "TrainingRequesterType" NOT NULL,
    "employeeId" TEXT NOT NULL,
    "submittedByAccountId" TEXT NOT NULL,
    "departmentIdSnapshot" TEXT,
    "positionIdSnapshot" TEXT,
    "reason" TEXT NOT NULL,
    "gapReferenceNote" TEXT,
    "requestedTopic" TEXT NOT NULL,
    "businessJustification" TEXT,
    "preferredTiming" TEXT,
    "status" "TrainingRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "deptHeadDecisionAt" TIMESTAMP(3),
    "deptHeadDecisionByAccountId" TEXT,
    "deptHeadDecisionPositionId" TEXT,
    "deptHeadNote" TEXT,
    "trainingAdminDecisionAt" TIMESTAMP(3),
    "trainingAdminDecisionByAccountId" TEXT,
    "trainingAdminNote" TEXT,
    "courseId" TEXT,
    "sessionId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "sourceType" "LearningAssignmentSourceType" NOT NULL,
    "sourceTrainingRequestId" TEXT,
    "sourceMandatoryRuleId" TEXT,
    "assignedByAccountId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LearningAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "attendanceConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "certificateNumber" TEXT,
    "certificateIssueDate" TIMESTAMP(3),
    "effectivenessRequiredSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessDueDate" TIMESTAMP(3),
    "effectivenessCompletedAt" TIMESTAMP(3),
    "effectivenessResult" "EffectivenessResult",
    "effectivenessEvaluatorId" TEXT,
    "effectivenessEvidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certificateExpiryDate" TIMESTAMP(3),
    "certificateFileId" TEXT,
    "attendanceEvidenceNote" TEXT,
    "attendanceEvidenceFileId" TEXT,
    "quizBonusAttempts" INTEGER NOT NULL DEFAULT 0,
    "overrideReason" TEXT,

    CONSTRAINT "LearningAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandatoryTrainingRule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "targetType" "MandatoryTargetType" NOT NULL,
    "targetEmployeeId" TEXT,
    "targetDepartmentId" TEXT,
    "targetJobId" TEXT,
    "targetPositionId" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandatoryTrainingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "materialType" "CourseMaterialType" NOT NULL,
    "fileId" TEXT,
    "externalUrl" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningAssignmentMaterialProgress" (
    "id" TEXT NOT NULL,
    "learningAssignmentId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningAssignmentMaterialProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "passingScorePercent" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "questionText" TEXT NOT NULL,
    "questionType" "QuizQuestionType" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "learningAssignmentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "scorePercent" DOUBLE PRECISION,
    "passed" BOOLEAN,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "QuizAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLocation" (
    "id" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "description" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT,
    "trackingType" "AssetTrackingType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "totalQuantity" INTEGER,
    "availableQuantity" INTEGER,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION,
    "notes" TEXT,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCustody" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "targetType" "AssetCustodyTargetType" NOT NULL,
    "employeeId" TEXT,
    "orgUnitId" TEXT,
    "locationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "AssetCustodyStatus" NOT NULL DEFAULT 'ACTIVE',
    "conditionAtHandover" TEXT,
    "handoverEvidenceFileId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByAccountId" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnedByAccountId" TEXT,
    "returnConditionNote" TEXT,
    "returnEvidenceFileId" TEXT,
    "inspectionResult" "AssetInspectionResult",
    "transferredToCustodyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetCustody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskForceMembership" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "addedByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskForceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GaRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requestType" "GaRequestType" NOT NULL,
    "status" "GaRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "urgency" "GaRequestUrgency" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "requesterEmployeeId" TEXT NOT NULL,
    "submittedByAccountId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT,
    "locationId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByAccountId" TEXT,
    "verificationNote" TEXT,
    "approvalRequired" BOOLEAN,
    "decisionAt" TIMESTAMP(3),
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "procurementReference" TEXT,
    "resultingCustodyId" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedByAccountId" TEXT,
    "lossReviewedAt" TIMESTAMP(3),
    "lossReviewedByAccountId" TEXT,
    "lossReviewedPositionId" TEXT,
    "lossReviewNote" TEXT,
    "evidenceFileId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GaApprovalConfig" (
    "id" TEXT NOT NULL,
    "approvalType" "GaApprovalType" NOT NULL,
    "approverPositionId" TEXT NOT NULL,
    "updatedByAccountId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GaApprovalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePlan" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "intervalDays" INTEGER,
    "intervalKm" INTEGER,
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceType" "MaintenanceSourceType" NOT NULL,
    "sourcePlanId" TEXT,
    "sourceGaRequestId" TEXT,
    "workType" "MaintenanceWorkType" NOT NULL,
    "checklistNotes" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceDate" TIMESTAMP(3),
    "odometerKm" INTEGER,
    "diagnosisNote" TEXT,
    "actionTakenNote" TEXT,
    "cost" DOUBLE PRECISION,
    "evidenceFileId" TEXT,
    "outcome" "MaintenanceOutcome",
    "nextDueDate" TIMESTAMP(3),
    "nextDueKm" INTEGER,
    "completedByAccountId" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisposalCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "reason" "DisposalReason" NOT NULL,
    "status" "DisposalStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceWorkOrderId" TEXT,
    "sourceGaRequestId" TEXT,
    "proposalNote" TEXT,
    "proposalEvidenceFileId" TEXT,
    "submittedForApprovalAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "decisionByAccountId" TEXT,
    "decisionPositionId" TEXT,
    "decisionNote" TEXT,
    "executionMethod" "DisposalMethod",
    "executionDate" TIMESTAMP(3),
    "executionValue" DOUBLE PRECISION,
    "executionReference" TEXT,
    "executionEvidenceFileId" TEXT,
    "executedByAccountId" TEXT,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisposalCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_evaluationNumber_key" ON "Evaluation"("evaluationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_caseNumber_key" ON "ContractRenewalCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_currentContractId_key" ON "ContractRenewalCase"("currentContractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_evaluationId_key" ON "ContractRenewalCase"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_linkedMovementRequestId_key" ON "ContractRenewalCase"("linkedMovementRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalCase_generatedContractId_key" ON "ContractRenewalCase"("generatedContractId");

-- CreateIndex
CREATE UNIQUE INDEX "OffboardingCase_caseNumber_key" ON "OffboardingCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OffboardingCase_sourceRenewalCaseId_key" ON "OffboardingCase"("sourceRenewalCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_employeeId_weekStartDate_key" ON "ShiftAssignment"("employeeId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "Account_usernameOrEmail_key" ON "Account"("usernameOrEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Account_employeeId_key" ON "Account"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountRole_accountId_role_key" ON "AccountRole"("accountId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_ktpFileId_key" ON "Employee"("ktpFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_kkFileId_key" ON "Employee"("kkFileId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationLevel_label_key" ON "EducationLevel"("label");

-- CreateIndex
CREATE UNIQUE INDEX "PtkpStatus_code_key" ON "PtkpStatus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_unitCode_key" ON "OrgUnit"("unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobCode_key" ON "Job"("jobCode");

-- CreateIndex
CREATE UNIQUE INDEX "Position_positionCode_key" ON "Position"("positionCode");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequest_requestNumber_key" ON "RecruitmentRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequestFulfillment_employeeId_key" ON "RecruitmentRequestFulfillment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequestFulfillment_assignmentId_key" ON "RecruitmentRequestFulfillment"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MovementRequest_requestNumber_key" ON "MovementRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MovementRequest_performanceEvaluationFileId_key" ON "MovementRequest"("performanceEvaluationFileId");

-- CreateIndex
CREATE UNIQUE INDEX "MovementRequest_evaluationId_key" ON "MovementRequest"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "MovementRequest_implementedAssignmentId_key" ON "MovementRequest"("implementedAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_caseNumber_key" ON "OnboardingCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_renewedFromContractId_key" ON "Contract"("renewedFromContractId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractFileId_key" ON "Contract"("contractFileId");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_storageKey_key" ON "FileObject"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceGeofence_siteName_key" ON "AttendanceGeofence"("siteName");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_selfieFileId_key" ON "AttendanceEvent"("selfieFileId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_checkInEventId_key" ON "DailyAttendanceRecord"("checkInEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_checkOutEventId_key" ON "DailyAttendanceRecord"("checkOutEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_employeeId_attendanceDate_key" ON "DailyAttendanceRecord"("employeeId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceApproverConfig_departmentId_key" ON "AbsenceApproverConfig"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceEntitlementConfig_absenceType_key" ON "AbsenceEntitlementConfig"("absenceType");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRequest_requestNumber_key" ON "AbsenceRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRequest_attachmentFileId_key" ON "AbsenceRequest"("attachmentFileId");

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
CREATE UNIQUE INDEX "CompetencyAssessmentItem_assessmentId_competencyDefinitionI_key" ON "CompetencyAssessmentItem"("assessmentId", "competencyDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyValueAssessmentItem_assessmentId_companyValueDefinit_key" ON "CompanyValueAssessmentItem"("assessmentId", "companyValueDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRequest_requestNumber_key" ON "TrainingRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAssignment_sourceTrainingRequestId_key" ON "LearningAssignment"("sourceTrainingRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAssignment_certificateFileId_key" ON "LearningAssignment"("certificateFileId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAssignment_attendanceEvidenceFileId_key" ON "LearningAssignment"("attendanceEvidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMaterial_fileId_key" ON "CourseMaterial"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAssignmentMaterialProgress_learningAssignmentId_mat_key" ON "LearningAssignmentMaterialProgress"("learningAssignmentId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_courseId_key" ON "Quiz"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_learningAssignmentId_attemptNumber_key" ON "QuizAttempt"("learningAssignmentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttemptAnswer_attemptId_questionId_optionId_key" ON "QuizAttemptAnswer"("attemptId", "questionId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLocation_locationName_key" ON "AssetLocation"("locationName");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetCode_key" ON "FixedAsset"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCustody_handoverEvidenceFileId_key" ON "AssetCustody"("handoverEvidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCustody_returnEvidenceFileId_key" ON "AssetCustody"("returnEvidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCustody_transferredToCustodyId_key" ON "AssetCustody"("transferredToCustodyId");

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

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_snapshotPositionId_fkey" FOREIGN KEY ("snapshotPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_responsibleHrAdminAccountId_fkey" FOREIGN KEY ("responsibleHrAdminAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_releasedByAccountId_fkey" FOREIGN KEY ("releasedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_p1EmployeeId_fkey" FOREIGN KEY ("p1EmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_p1PositionId_fkey" FOREIGN KEY ("p1PositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_p2EmployeeId_fkey" FOREIGN KEY ("p2EmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_p2PositionId_fkey" FOREIGN KEY ("p2PositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_currentContractId_fkey" FOREIGN KEY ("currentContractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_snapshotPositionId_fkey" FOREIGN KEY ("snapshotPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_deptHeadEmployeeId_fkey" FOREIGN KEY ("deptHeadEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_deptHeadPositionId_fkey" FOREIGN KEY ("deptHeadPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_deptHeadProposedPositionId_fkey" FOREIGN KEY ("deptHeadProposedPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_linkedMovementRequestId_fkey" FOREIGN KEY ("linkedMovementRequestId") REFERENCES "MovementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalCase" ADD CONSTRAINT "ContractRenewalCase_generatedContractId_fkey" FOREIGN KEY ("generatedContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_reportedByAccountId_fkey" FOREIGN KEY ("reportedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_sourceRenewalCaseId_fkey" FOREIGN KEY ("sourceRenewalCaseId") REFERENCES "ContractRenewalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_hrManagerDecisionByAccountId_fkey" FOREIGN KEY ("hrManagerDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_hrManagerDecisionPositionId_fkey" FOREIGN KEY ("hrManagerDecisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_clearanceCompletedByAccountId_fkey" FOREIGN KEY ("clearanceCompletedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_submittedByPositionId_fkey" FOREIGN KEY ("submittedByPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRole" ADD CONSTRAINT "AccountRole_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_ptkpStatusCode_fkey" FOREIGN KEY ("ptkpStatusCode") REFERENCES "PtkpStatus"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_ktpFileId_fkey" FOREIGN KEY ("ktpFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_kkFileId_fkey" FOREIGN KEY ("kkFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_reportsToPositionId_fkey" FOREIGN KEY ("reportsToPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_requestedPositionId_fkey" FOREIGN KEY ("requestedPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_requesterPositionId_fkey" FOREIGN KEY ("requesterPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_approvedByAccountId_fkey" FOREIGN KEY ("approvedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_cancelledByEmployeeId_fkey" FOREIGN KEY ("cancelledByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequestFulfillment" ADD CONSTRAINT "RecruitmentRequestFulfillment_recruitmentRequestId_fkey" FOREIGN KEY ("recruitmentRequestId") REFERENCES "RecruitmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequestFulfillment" ADD CONSTRAINT "RecruitmentRequestFulfillment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequestFulfillment" ADD CONSTRAINT "RecruitmentRequestFulfillment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequestFulfillment" ADD CONSTRAINT "RecruitmentRequestFulfillment_linkedByAccountId_fkey" FOREIGN KEY ("linkedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_currentAssignmentId_fkey" FOREIGN KEY ("currentAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_proposedPositionId_fkey" FOREIGN KEY ("proposedPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_requesterPositionId_fkey" FOREIGN KEY ("requesterPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_performanceEvaluationFileId_fkey" FOREIGN KEY ("performanceEvaluationFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_implementedByAccountId_fkey" FOREIGN KEY ("implementedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_implementedAssignmentId_fkey" FOREIGN KEY ("implementedAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_cancelledByEmployeeId_fkey" FOREIGN KEY ("cancelledByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_contractCompletedByAccountId_fkey" FOREIGN KEY ("contractCompletedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_renewedFromContractId_fkey" FOREIGN KEY ("renewedFromContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_recommendationByEmployeeId_fkey" FOREIGN KEY ("recommendationByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_recommendationByPositionId_fkey" FOREIGN KEY ("recommendationByPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_releasedByAccountId_fkey" FOREIGN KEY ("releasedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_releasedByPositionId_fkey" FOREIGN KEY ("releasedByPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_contractFileId_fkey" FOREIGN KEY ("contractFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedByAccountId_fkey" FOREIGN KEY ("uploadedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_uploadedByAccountId_fkey" FOREIGN KEY ("uploadedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAssignment" ADD CONSTRAINT "AttendanceAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAssignment" ADD CONSTRAINT "AttendanceAssignment_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "AttendanceGeofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAssignment" ADD CONSTRAINT "AttendanceAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_attendanceAssignmentId_fkey" FOREIGN KEY ("attendanceAssignmentId") REFERENCES "AttendanceAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "AttendanceGeofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_selfieFileId_fkey" FOREIGN KEY ("selfieFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_checkInEventId_fkey" FOREIGN KEY ("checkInEventId") REFERENCES "AttendanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_checkOutEventId_fkey" FOREIGN KEY ("checkOutEventId") REFERENCES "AttendanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceApproverConfig" ADD CONSTRAINT "AbsenceApproverConfig_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceApproverConfig" ADD CONSTRAINT "AbsenceApproverConfig_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_attachmentFileId_fkey" FOREIGN KEY ("attachmentFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_firstApproverPositionId_fkey" FOREIGN KEY ("firstApproverPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_firstDecisionByAccountId_fkey" FOREIGN KEY ("firstDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_hrAdminDecisionByAccountId_fkey" FOREIGN KEY ("hrAdminDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_hrOverrideByAccountId_fkey" FOREIGN KEY ("hrOverrideByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyDefinition" ADD CONSTRAINT "CompetencyDefinition_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "CompetencyFrameworkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyLevelIndicator" ADD CONSTRAINT "CompetencyLevelIndicator_competencyDefinitionId_fkey" FOREIGN KEY ("competencyDefinitionId") REFERENCES "CompetencyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyValueDefinition" ADD CONSTRAINT "CompanyValueDefinition_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "CompanyValueFrameworkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyValueRubricIndicator" ADD CONSTRAINT "CompanyValueRubricIndicator_companyValueDefinitionId_fkey" FOREIGN KEY ("companyValueDefinitionId") REFERENCES "CompanyValueDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionCompetencyRequirement" ADD CONSTRAINT "PositionCompetencyRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionCompetencyRequirement" ADD CONSTRAINT "PositionCompetencyRequirement_competencyDefinitionId_fkey" FOREIGN KEY ("competencyDefinitionId") REFERENCES "CompetencyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionCompetencyRequirement" ADD CONSTRAINT "PositionCompetencyRequirement_updatedByAccountId_fkey" FOREIGN KEY ("updatedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessmentCycle" ADD CONSTRAINT "CompetencyAssessmentCycle_competencyFrameworkVersionId_fkey" FOREIGN KEY ("competencyFrameworkVersionId") REFERENCES "CompetencyFrameworkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessmentCycle" ADD CONSTRAINT "CompetencyAssessmentCycle_companyValueFrameworkVersionId_fkey" FOREIGN KEY ("companyValueFrameworkVersionId") REFERENCES "CompanyValueFrameworkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessmentCycle" ADD CONSTRAINT "CompetencyAssessmentCycle_openedByAccountId_fkey" FOREIGN KEY ("openedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CompetencyAssessmentCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_p1EmployeeId_fkey" FOREIGN KEY ("p1EmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_p1PositionId_fkey" FOREIGN KEY ("p1PositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_p2EmployeeId_fkey" FOREIGN KEY ("p2EmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_p2PositionId_fkey" FOREIGN KEY ("p2PositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyEvaluatorChange" ADD CONSTRAINT "CompetencyEvaluatorChange_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyEvaluatorChange" ADD CONSTRAINT "CompetencyEvaluatorChange_oldEmployeeId_fkey" FOREIGN KEY ("oldEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyEvaluatorChange" ADD CONSTRAINT "CompetencyEvaluatorChange_newEmployeeId_fkey" FOREIGN KEY ("newEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyEvaluatorChange" ADD CONSTRAINT "CompetencyEvaluatorChange_changedByAccountId_fkey" FOREIGN KEY ("changedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessmentItem" ADD CONSTRAINT "CompetencyAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessmentItem" ADD CONSTRAINT "CompetencyAssessmentItem_competencyDefinitionId_fkey" FOREIGN KEY ("competencyDefinitionId") REFERENCES "CompetencyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyValueAssessmentItem" ADD CONSTRAINT "CompanyValueAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyValueAssessmentItem" ADD CONSTRAINT "CompanyValueAssessmentItem_companyValueDefinitionId_fkey" FOREIGN KEY ("companyValueDefinitionId") REFERENCES "CompanyValueDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_departmentIdSnapshot_fkey" FOREIGN KEY ("departmentIdSnapshot") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_positionIdSnapshot_fkey" FOREIGN KEY ("positionIdSnapshot") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_deptHeadDecisionByAccountId_fkey" FOREIGN KEY ("deptHeadDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_deptHeadDecisionPositionId_fkey" FOREIGN KEY ("deptHeadDecisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_trainingAdminDecisionByAccountId_fkey" FOREIGN KEY ("trainingAdminDecisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_sourceTrainingRequestId_fkey" FOREIGN KEY ("sourceTrainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_sourceMandatoryRuleId_fkey" FOREIGN KEY ("sourceMandatoryRuleId") REFERENCES "MandatoryTrainingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_effectivenessEvaluatorId_fkey" FOREIGN KEY ("effectivenessEvaluatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_certificateFileId_fkey" FOREIGN KEY ("certificateFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignment" ADD CONSTRAINT "LearningAssignment_attendanceEvidenceFileId_fkey" FOREIGN KEY ("attendanceEvidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryTrainingRule" ADD CONSTRAINT "MandatoryTrainingRule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryTrainingRule" ADD CONSTRAINT "MandatoryTrainingRule_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryTrainingRule" ADD CONSTRAINT "MandatoryTrainingRule_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryTrainingRule" ADD CONSTRAINT "MandatoryTrainingRule_targetJobId_fkey" FOREIGN KEY ("targetJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryTrainingRule" ADD CONSTRAINT "MandatoryTrainingRule_targetPositionId_fkey" FOREIGN KEY ("targetPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryTrainingRule" ADD CONSTRAINT "MandatoryTrainingRule_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignmentMaterialProgress" ADD CONSTRAINT "LearningAssignmentMaterialProgress_learningAssignmentId_fkey" FOREIGN KEY ("learningAssignmentId") REFERENCES "LearningAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAssignmentMaterialProgress" ADD CONSTRAINT "LearningAssignmentMaterialProgress_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_learningAssignmentId_fkey" FOREIGN KEY ("learningAssignmentId") REFERENCES "LearningAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemptAnswer" ADD CONSTRAINT "QuizAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemptAnswer" ADD CONSTRAINT "QuizAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemptAnswer" ADD CONSTRAINT "QuizAttemptAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuizOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_handoverEvidenceFileId_fkey" FOREIGN KEY ("handoverEvidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_assignedByAccountId_fkey" FOREIGN KEY ("assignedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_returnedByAccountId_fkey" FOREIGN KEY ("returnedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCustody" ADD CONSTRAINT "AssetCustody_returnEvidenceFileId_fkey" FOREIGN KEY ("returnEvidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskForceMembership" ADD CONSTRAINT "TaskForceMembership_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskForceMembership" ADD CONSTRAINT "TaskForceMembership_addedByAccountId_fkey" FOREIGN KEY ("addedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_verifiedByAccountId_fkey" FOREIGN KEY ("verifiedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_processedByAccountId_fkey" FOREIGN KEY ("processedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_lossReviewedByAccountId_fkey" FOREIGN KEY ("lossReviewedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_lossReviewedPositionId_fkey" FOREIGN KEY ("lossReviewedPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaRequest" ADD CONSTRAINT "GaRequest_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaApprovalConfig" ADD CONSTRAINT "GaApprovalConfig_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaApprovalConfig" ADD CONSTRAINT "GaApprovalConfig_updatedByAccountId_fkey" FOREIGN KEY ("updatedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_completedByAccountId_fkey" FOREIGN KEY ("completedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_proposalEvidenceFileId_fkey" FOREIGN KEY ("proposalEvidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_decisionByAccountId_fkey" FOREIGN KEY ("decisionByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_decisionPositionId_fkey" FOREIGN KEY ("decisionPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_executionEvidenceFileId_fkey" FOREIGN KEY ("executionEvidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_executedByAccountId_fkey" FOREIGN KEY ("executedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalCase" ADD CONSTRAINT "DisposalCase_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

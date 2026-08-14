import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { Employee } from "@/generated/prisma/client";
import {
  isHrAdmin,
  isTrainingAdmin,
  isGaAdmin,
  isHrManager,
  canApproveRecruitmentRequest,
  canApproveRecruitmentRequestAsDeptHead,
  canCancelRecruitmentRequest,
  canSubmitMovementRequest,
  canApproveMovementRequest,
  canApproveMovementRequestAsDeptHead,
  canExecuteMovementRequest,
  canCancelMovementRequest,
  canViewOnboarding,
  canMarkOnboardingContract,
  canMarkOnboardingTraining,
  canViewContract,
  canManageContracts,
  canApproveContractRelease,
  canSubmitContractRecommendation,
  canDecideContractRenewal,
  canSignContract,
  canViewEmployeeDocument,
  canUploadEmployeeDocument,
  canReportResignation,
  canDecideOffboardingCaseAsDeptHead,
  canDecideOffboardingCase,
  canExecuteExitClearance,
  canCancelOffboardingCase,
  canViewOffboardingCase,
  canSubmitShiftAssignment,
  canViewShiftAssignments,
  isDirector,
  canManageCompetencyFramework,
  canOpenCompetencyCycle,
  canScoreAsCompetencyP1,
  canScoreAsCompetencyP2,
  canReassignCompetencyEvaluator,
  canViewOwnCompetencyResult,
  canViewCompetencyAssessment,
  canRunCompetencyHistoricalMigration,
  canSubmitTrainingRequest,
  canDecideTrainingRequestAsDeptHead,
  canValidateTrainingRequest,
  canScheduleTrainingRequest,
  canCancelTrainingRequest,
  canManageTrainingCourse,
  canManageLearningAssignment,
  canRecordLearningEffectiveness,
  canManageMandatoryTrainingRule,
  canViewTrainingRequest,
  canTakeQuiz,
  canViewLearningAssignment,
  canViewCompanyWideLmsReporting,
  canManageAssets,
  canViewAssetMaster,
  canImportAssetMaster,
  canViewOwnAssetCustody,
  projectEmployee,
} from "./permissions";

function mockSession(overrides: {
  employeeId?: string | null;
  roles?: string[];
}): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: {
      id: "account-1",
      accountType: "ADMIN",
      adminScope: "NONE",
      employeeId: overrides.employeeId ?? null,
      roles: (overrides.roles ?? []) as never,
    },
  };
}

function mockEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    employeeNumber: "CBP-0001",
    fullLegalName: "Contoh Karyawan",
    preferredName: null,
    nationalIdNumber: "1234567890123456",
    birthPlace: null,
    birthDate: null,
    gender: null,
    personalEmail: null,
    workEmail: null,
    mobileNumber: null,
    currentAddress: null,
    emergencyContactName: null,
    emergencyContactRelation: null,
    emergencyContactPhone: null,
    bankAccountName: null,
    bankAccountNumber: "9999999999",
    taxId: null,
    bpjsEmploymentNumber: null,
    bpjsHealthNumber: null,
    noKk: "3374010101880001",
    namaIbuKandung: "Ibu Contoh",
    educationLevelId: "edu-1",
    ptkpStatusCode: "K/1",
    ktpFileId: "file-ktp",
    kkFileId: "file-kk",
    hireDate: new Date("2022-01-01"),
    employmentStatus: "PKWTT",
    currentPositionId: null,
    activeFlag: true,
    createdAt: new Date("2022-01-01"),
    updatedAt: new Date("2022-01-01"),
    ...overrides,
  } as Employee;
}

describe("role predicates", () => {
  it("recognizes each admin role independently", () => {
    expect(isHrAdmin(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(isTrainingAdmin(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(isGaAdmin(mockSession({ roles: ["GA_ADMIN"] }))).toBe(true);
    expect(isHrAdmin(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(false);
  });
});

describe("isHrManager / canApproveRecruitmentRequest (ACC-14/WF-15)", () => {
  it("is false with zero active HR Manager positions", () => {
    expect(isHrManager([])).toBe(false);
    expect(canApproveRecruitmentRequest([])).toBe(false);
  });

  it("is true as soon as there's at least one active HR Manager position", () => {
    expect(isHrManager(["pos-hr-manager"])).toBe(true);
    expect(canApproveRecruitmentRequest(["pos-hr-manager"])).toBe(true);
  });

  it("does not require being HR Admin — an HR_ADMIN session with no HR Manager position still can't approve", () => {
    // canApproveRecruitmentRequest only ever looks at the resolved position
    // list now, never the session/role — this is the WF-15 correction: HR
    // Admin has read-only decision access, no approve/return/reject.
    expect(canApproveRecruitmentRequest([])).toBe(false);
  });
});

describe("canApproveRecruitmentRequestAsDeptHead (dept-head approval gate)", () => {
  it("is false with zero active level-3B positions in the request's department", () => {
    expect(canApproveRecruitmentRequestAsDeptHead([])).toBe(false);
  });

  it("is true as soon as there's at least one active level-3B position there", () => {
    expect(canApproveRecruitmentRequestAsDeptHead(["pos-dept-head"])).toBe(true);
  });
});

describe("canCancelRecruitmentRequest (DM-25/ACC-16)", () => {
  it("allows the original Requester even with no admin role and no HR Manager position", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-requester" });
    expect(canCancelRecruitmentRequest(session, "emp-requester", [])).toBe(true);
  });

  it("allows an active HR Manager who is not the Requester", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-hr-manager" });
    expect(canCancelRecruitmentRequest(session, "emp-requester", ["pos-hr-manager"])).toBe(true);
  });

  it("allows HR Admin who is neither the Requester nor an HR Manager", () => {
    const session = mockSession({ roles: ["HR_ADMIN"], employeeId: null });
    expect(canCancelRecruitmentRequest(session, "emp-requester", [])).toBe(true);
  });

  it("denies a plain employee who is neither the Requester, an HR Manager, nor HR Admin", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-bystander" });
    expect(canCancelRecruitmentRequest(session, "emp-requester", [])).toBe(false);
  });
});

describe("canSubmitMovementRequest (Perubahan Posisi refactor)", () => {
  it("allows a Level-3 (3A/3B) holder in the employee's own department", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "level3-1" });
    expect(canSubmitMovementRequest(session, true)).toBe(true);
  });

  it("allows HR Admin even when not Level 3 there", () => {
    const session = mockSession({ roles: ["HR_ADMIN"], employeeId: null });
    expect(canSubmitMovementRequest(session, false)).toBe(true);
  });

  it("denies a plain employee who isn't Level 3 in that department", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" });
    expect(canSubmitMovementRequest(session, false)).toBe(false);
  });
});

describe("canApproveMovementRequestAsDeptHead (Perubahan Posisi refactor)", () => {
  it("is false with zero active level-3B positions in the request's department", () => {
    expect(canApproveMovementRequestAsDeptHead([])).toBe(false);
  });

  it("is true as soon as there's at least one active level-3B position there", () => {
    expect(canApproveMovementRequestAsDeptHead(["pos-dept-head"])).toBe(true);
  });
});

describe("canApproveMovementRequest / canExecuteMovementRequest (LIF-04)", () => {
  it("approval requires an active HR Manager position, not HR Admin", () => {
    expect(canApproveMovementRequest([])).toBe(false);
    expect(canApproveMovementRequest(["pos-hr-manager"])).toBe(true);
  });

  it("execution requires HR Admin", () => {
    expect(canExecuteMovementRequest(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canExecuteMovementRequest(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }))).toBe(false);
  });
});

describe("canCancelMovementRequest", () => {
  it("allows the original Requester, an active HR Manager, or HR Admin", () => {
    expect(
      canCancelMovementRequest(mockSession({ roles: ["EMPLOYEE"], employeeId: "requester-1" }), "requester-1", [])
    ).toBe(true);
    expect(
      canCancelMovementRequest(mockSession({ roles: ["EMPLOYEE"], employeeId: "hr-manager-1" }), "requester-1", [
        "pos-hr-manager",
      ])
    ).toBe(true);
    expect(canCancelMovementRequest(mockSession({ roles: ["HR_ADMIN"], employeeId: null }), "requester-1", [])).toBe(
      true
    );
  });

  it("denies a bystander", () => {
    expect(
      canCancelMovementRequest(mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" }), "requester-1", [])
    ).toBe(false);
  });
});

describe("Onboarding visibility and completion ownership (LIF-03)", () => {
  it("canViewOnboarding allows HR Admin, Training Admin, GA Admin, and an active HR Manager", () => {
    expect(canViewOnboarding(mockSession({ roles: ["HR_ADMIN"] }), [])).toBe(true);
    expect(canViewOnboarding(mockSession({ roles: ["TRAINING_ADMIN"] }), [])).toBe(true);
    expect(canViewOnboarding(mockSession({ roles: ["GA_ADMIN"] }), [])).toBe(true);
    expect(canViewOnboarding(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }), ["pos-hr-manager"])).toBe(
      true
    );
  });

  it("canViewOnboarding denies a plain employee with no admin role or HR Manager position", () => {
    expect(canViewOnboarding(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }), [])).toBe(false);
  });

  it("each completion flag is owned by its Primary Owner, plus HR Admin", () => {
    expect(canMarkOnboardingContract(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canMarkOnboardingContract(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(false);
    expect(canMarkOnboardingTraining(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(canMarkOnboardingTraining(mockSession({ roles: ["GA_ADMIN"] }))).toBe(false);
    expect(canMarkOnboardingTraining(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
  });
});

describe("Contract permissions (WF-10, LIF-08..12, Data Fields Blueprint '08 Contracts')", () => {
  it("canViewContract: HR Admin sees any, the employee sees only their own", () => {
    expect(canViewContract(mockSession({ roles: ["HR_ADMIN"] }), "emp-1")).toBe(true);
    expect(canViewContract(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }), "emp-1")).toBe(true);
    expect(canViewContract(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-2" }), "emp-1")).toBe(false);
  });

  it("canManageContracts is HR Admin only", () => {
    expect(canManageContracts(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canManageContracts(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }))).toBe(false);
  });

  it("canApproveContractRelease only an active HR Manager Position holder (not HR Admin alone)", () => {
    expect(canApproveContractRelease(["pos-hr-manager"])).toBe(true);
    expect(canApproveContractRelease([])).toBe(false);
  });

  it("canSubmitContractRecommendation allows the employee's direct manager or HR Admin", () => {
    expect(canSubmitContractRecommendation(mockSession({ roles: ["EMPLOYEE"], employeeId: "mgr-1" }), true)).toBe(
      true
    );
    expect(canSubmitContractRecommendation(mockSession({ roles: ["HR_ADMIN"] }), false)).toBe(true);
    expect(canSubmitContractRecommendation(mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" }), false)).toBe(
      false
    );
  });

  it("canDecideContractRenewal requires an active HR Manager position, not HR Admin", () => {
    expect(canDecideContractRenewal([])).toBe(false);
    expect(canDecideContractRenewal(["pos-hr-manager"])).toBe(true);
  });

  it("canSignContract is the covered employee only, never HR Admin on their behalf", () => {
    expect(canSignContract(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }), "emp-1")).toBe(true);
    expect(canSignContract(mockSession({ roles: ["HR_ADMIN"], employeeId: null }), "emp-1")).toBe(false);
  });
});

describe("canViewEmployeeDocument (CTL-12)", () => {
  it("allows HR Admin to view any employee's documents", () => {
    const session = mockSession({ roles: ["HR_ADMIN"], employeeId: null });
    expect(canViewEmployeeDocument(session, "some-other-employee")).toBe(true);
  });

  it("allows an employee to view their own documents", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" });
    expect(canViewEmployeeDocument(session, "emp-1")).toBe(true);
  });

  it("denies a plain employee viewing someone else's documents", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" });
    expect(canViewEmployeeDocument(session, "emp-2")).toBe(false);
  });

  it("denies Training Admin, GA Admin, and a manager (no automatic access)", () => {
    expect(canViewEmployeeDocument(mockSession({ roles: ["TRAINING_ADMIN"] }), "emp-1")).toBe(false);
    expect(canViewEmployeeDocument(mockSession({ roles: ["GA_ADMIN"] }), "emp-1")).toBe(false);
    // A "manager" in this app is just an EMPLOYEE-role account with direct
    // reports — no special document access derived from that.
    expect(canViewEmployeeDocument(mockSession({ roles: ["EMPLOYEE"], employeeId: "manager-1" }), "emp-1")).toBe(
      false
    );
  });
});

describe("canUploadEmployeeDocument", () => {
  it("is HR Admin only — not even the employee themselves", () => {
    expect(canUploadEmployeeDocument(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canUploadEmployeeDocument(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }))).toBe(false);
    expect(canUploadEmployeeDocument(mockSession({ roles: ["GA_ADMIN"] }))).toBe(false);
  });
});

describe("projectEmployee field-level scope (ACC-10 / DM-17 sensitivity)", () => {
  it("gives HR Admin the full record including noKk/namaIbuKandung/ptkpStatusCode", () => {
    const session = mockSession({ roles: ["HR_ADMIN"] });
    const result = projectEmployee(mockEmployee(), session);
    expect(result.noKk).toBe("3374010101880001");
    expect(result.namaIbuKandung).toBe("Ibu Contoh");
    expect(result.ptkpStatusCode).toBe("K/1");
  });

  it("gives the employee themself the full record", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" });
    const result = projectEmployee(mockEmployee({ id: "emp-1" }), session);
    expect(result.noKk).toBe("3374010101880001");
  });

  it("strips noKk/namaIbuKandung/ptkpStatusCode/ktpFileId/kkFileId from Training Admin", () => {
    const session = mockSession({ roles: ["TRAINING_ADMIN"] });
    const result = projectEmployee(mockEmployee(), session);
    expect(result.noKk).toBeUndefined();
    expect(result.namaIbuKandung).toBeUndefined();
    expect(result.ptkpStatusCode).toBeUndefined();
    expect(result.ktpFileId).toBeUndefined();
    expect(result.kkFileId).toBeUndefined();
  });

  it("strips the same identity fields from GA Admin", () => {
    const session = mockSession({ roles: ["GA_ADMIN"] });
    const result = projectEmployee(mockEmployee(), session);
    expect(result.noKk).toBeUndefined();
    expect(result.namaIbuKandung).toBeUndefined();
    expect(result.ptkpStatusCode).toBeUndefined();
  });
});

describe("canReportResignation (LIF-06)", () => {
  it("allows the employee's direct manager or HR Admin", () => {
    expect(canReportResignation(mockSession({ roles: ["EMPLOYEE"] }), true)).toBe(true);
    expect(canReportResignation(mockSession({ roles: ["HR_ADMIN"] }), false)).toBe(true);
  });

  it("denies anyone else", () => {
    expect(canReportResignation(mockSession({ roles: ["EMPLOYEE"] }), false)).toBe(false);
  });
});

describe("canDecideOffboardingCaseAsDeptHead", () => {
  it("only an active Dept Head (3B) Position holder", () => {
    expect(canDecideOffboardingCaseAsDeptHead(["pos-dept-head"])).toBe(true);
    expect(canDecideOffboardingCaseAsDeptHead([])).toBe(false);
  });
});

describe("canDecideOffboardingCase", () => {
  it("only an active HR Manager Position holder", () => {
    expect(canDecideOffboardingCase(["pos-hr-manager"])).toBe(true);
    expect(canDecideOffboardingCase([])).toBe(false);
  });
});

describe("canExecuteExitClearance (LIF-06)", () => {
  it("HR Admin only", () => {
    expect(canExecuteExitClearance(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canExecuteExitClearance(mockSession({ roles: ["EMPLOYEE"] }))).toBe(false);
  });
});

describe("canCancelOffboardingCase", () => {
  it("allows the reporter (matching Account id), an active HR Manager, or HR Admin", () => {
    expect(canCancelOffboardingCase(mockSession({ roles: ["EMPLOYEE"] }), "account-1", [])).toBe(true);
    expect(canCancelOffboardingCase(mockSession({ roles: ["EMPLOYEE"] }), "someone-else", ["pos-hr-manager"])).toBe(
      true
    );
    expect(canCancelOffboardingCase(mockSession({ roles: ["HR_ADMIN"] }), "someone-else", [])).toBe(true);
  });

  it("denies a bystander", () => {
    expect(canCancelOffboardingCase(mockSession({ roles: ["EMPLOYEE"] }), "someone-else", [])).toBe(false);
  });
});

describe("canViewOffboardingCase", () => {
  it("allows HR Admin, an active HR Manager, an active Dept Head, the subject employee, or their direct manager", () => {
    expect(canViewOffboardingCase(mockSession({ roles: ["HR_ADMIN"] }), "emp-1", [], false)).toBe(true);
    expect(canViewOffboardingCase(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", ["pos-hr-manager"], false)).toBe(
      true
    );
    expect(canViewOffboardingCase(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }), "emp-1", [], false)).toBe(
      true
    );
    expect(canViewOffboardingCase(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", [], true)).toBe(true);
    expect(canViewOffboardingCase(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", [], false, ["pos-dept-head"])).toBe(
      true
    );
  });

  it("denies a bystander", () => {
    expect(canViewOffboardingCase(mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" }), "emp-1", [], false)).toBe(
      false
    );
  });
});

describe("canSubmitShiftAssignment", () => {
  it("allows HR Admin or an active Level-3 in the employee's department", () => {
    expect(canSubmitShiftAssignment(mockSession({ roles: ["HR_ADMIN"] }), false)).toBe(true);
    expect(canSubmitShiftAssignment(mockSession({ roles: ["EMPLOYEE"] }), true)).toBe(true);
    expect(canSubmitShiftAssignment(mockSession({ roles: ["EMPLOYEE"] }), false)).toBe(false);
  });
});

describe("canViewShiftAssignments", () => {
  it("allows HR Admin, the employee themself, or their department's Level-3", () => {
    expect(canViewShiftAssignments(mockSession({ roles: ["HR_ADMIN"] }), "emp-1", false)).toBe(true);
    expect(canViewShiftAssignments(mockSession({ roles: ["EMPLOYEE"], employeeId: "emp-1" }), "emp-1", false)).toBe(
      true
    );
    expect(canViewShiftAssignments(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", true)).toBe(true);
    expect(canViewShiftAssignments(mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" }), "emp-1", false)).toBe(
      false
    );
  });
});

describe("isDirector", () => {
  it("true only with at least one active Director position", () => {
    expect(isDirector(["pos-director"])).toBe(true);
    expect(isDirector([])).toBe(false);
  });
});

describe("canManageCompetencyFramework / canOpenCompetencyCycle (ACC-03)", () => {
  it("allows Training Admin or HR Admin, denies a plain employee", () => {
    expect(canManageCompetencyFramework(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(canManageCompetencyFramework(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canManageCompetencyFramework(mockSession({ roles: ["EMPLOYEE"] }))).toBe(false);
    expect(canOpenCompetencyCycle(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(canOpenCompetencyCycle(mockSession({ roles: ["EMPLOYEE"] }))).toBe(false);
  });
});

describe("canScoreAsCompetencyP1 / canScoreAsCompetencyP2 (ACC-21)", () => {
  it("only the exact assigned evaluator may score their own slot", () => {
    expect(canScoreAsCompetencyP1("emp-p1", "emp-p1")).toBe(true);
    expect(canScoreAsCompetencyP1("emp-other", "emp-p1")).toBe(false);
    expect(canScoreAsCompetencyP1(null, "emp-p1")).toBe(false);
    expect(canScoreAsCompetencyP2("emp-p2", "emp-p2")).toBe(true);
    expect(canScoreAsCompetencyP2("emp-p1", "emp-p2")).toBe(false);
  });
});

describe("canReassignCompetencyEvaluator (ACC-21)", () => {
  it("HR Admin only", () => {
    expect(canReassignCompetencyEvaluator(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canReassignCompetencyEvaluator(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(false);
  });
});

describe("canViewOwnCompetencyResult (COM-10)", () => {
  it("only the subject, and only once finalized", () => {
    expect(canViewOwnCompetencyResult(mockSession({ employeeId: "emp-1" }), "emp-1", new Date())).toBe(true);
    expect(canViewOwnCompetencyResult(mockSession({ employeeId: "emp-1" }), "emp-1", null)).toBe(false);
    expect(canViewOwnCompetencyResult(mockSession({ employeeId: "emp-2" }), "emp-1", new Date())).toBe(false);
  });
});

describe("canViewCompetencyAssessment (COM-10/ACC-21)", () => {
  it("allows HR Admin, Training Admin, either evaluator, the finalized subject, Level-3 dept, or the Director", () => {
    expect(canViewCompetencyAssessment(mockSession({ roles: ["HR_ADMIN"] }), "emp-1", null, null, null, false, [])).toBe(
      true
    );
    expect(
      canViewCompetencyAssessment(mockSession({ roles: ["TRAINING_ADMIN"] }), "emp-1", null, null, null, false, [])
    ).toBe(true);
    expect(
      canViewCompetencyAssessment(mockSession({ employeeId: "emp-p1" }), "emp-1", "emp-p1", null, null, false, [])
    ).toBe(true);
    expect(
      canViewCompetencyAssessment(mockSession({ employeeId: "emp-1" }), "emp-1", null, null, new Date(), false, [])
    ).toBe(true);
    expect(canViewCompetencyAssessment(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", null, null, null, true, [])).toBe(
      true
    );
    expect(
      canViewCompetencyAssessment(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", null, null, null, false, ["pos-director"])
    ).toBe(true);
  });

  it("denies a bystander", () => {
    expect(
      canViewCompetencyAssessment(mockSession({ employeeId: "bystander-1" }), "emp-1", null, null, null, false, [])
    ).toBe(false);
  });
});

describe("canRunCompetencyHistoricalMigration (ACC-24)", () => {
  it("HR Admin only, not Training Admin", () => {
    expect(canRunCompetencyHistoricalMigration(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canRunCompetencyHistoricalMigration(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(false);
  });
});

describe("canSubmitTrainingRequest (TRN-09/ACC-22)", () => {
  it("allows self, an active Level-3 in the employee's department, or HR Admin", () => {
    expect(canSubmitTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), true, false)).toBe(true);
    expect(canSubmitTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), false, true)).toBe(true);
    expect(canSubmitTrainingRequest(mockSession({ roles: ["HR_ADMIN"] }), false, false)).toBe(true);
    expect(canSubmitTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), false, false)).toBe(false);
  });
});

describe("canDecideTrainingRequestAsDeptHead / canValidateTrainingRequest / canScheduleTrainingRequest (TRN-10)", () => {
  it("Department Head decides first; Training Admin/HR Admin validate and schedule", () => {
    expect(canDecideTrainingRequestAsDeptHead(["pos-dept-head"])).toBe(true);
    expect(canDecideTrainingRequestAsDeptHead([])).toBe(false);
    expect(canValidateTrainingRequest(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(canValidateTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }))).toBe(false);
    expect(canScheduleTrainingRequest(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
  });
});

describe("canCancelTrainingRequest", () => {
  it("allows the requester, Training Admin, or HR Admin", () => {
    expect(canCancelTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), true)).toBe(true);
    expect(canCancelTrainingRequest(mockSession({ roles: ["TRAINING_ADMIN"] }), false)).toBe(true);
    expect(canCancelTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), false)).toBe(false);
  });
});

describe("canManageTrainingCourse / canManageLearningAssignment / canManageMandatoryTrainingRule (ACC-22/23)", () => {
  it("Training Admin or HR Admin only", () => {
    expect(canManageTrainingCourse(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(canManageTrainingCourse(mockSession({ roles: ["EMPLOYEE"] }))).toBe(false);
    expect(canManageLearningAssignment(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
    expect(canManageMandatoryTrainingRule(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(true);
    expect(canManageMandatoryTrainingRule(mockSession({ roles: ["EMPLOYEE"] }))).toBe(false);
  });
});

describe("canRecordLearningEffectiveness (TRN-04)", () => {
  it("the employee's supervisor or HR Admin", () => {
    expect(canRecordLearningEffectiveness(mockSession({ roles: ["EMPLOYEE"] }), true)).toBe(true);
    expect(canRecordLearningEffectiveness(mockSession({ roles: ["HR_ADMIN"] }), false)).toBe(true);
    expect(canRecordLearningEffectiveness(mockSession({ roles: ["EMPLOYEE"] }), false)).toBe(false);
  });
});

describe("canViewTrainingRequest (TRN-02/ACC-22)", () => {
  it("allows HR Admin, Training Admin, the subject, the submitter, or an eligible Department Head", () => {
    expect(canViewTrainingRequest(mockSession({ roles: ["HR_ADMIN"] }), "emp-1", "account-x", [])).toBe(true);
    expect(canViewTrainingRequest(mockSession({ roles: ["TRAINING_ADMIN"] }), "emp-1", "account-x", [])).toBe(true);
    expect(canViewTrainingRequest(mockSession({ employeeId: "emp-1" }), "emp-1", "account-x", [])).toBe(true);
    expect(canViewTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", "account-1", [])).toBe(true);
    expect(canViewTrainingRequest(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", "account-x", ["pos-dept-head"])).toBe(
      true
    );
  });

  it("denies a bystander", () => {
    expect(
      canViewTrainingRequest(mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" }), "emp-1", "account-x", [])
    ).toBe(false);
  });
});

describe("canTakeQuiz", () => {
  it("only the exact assigned employee, never a manager or admin on their behalf", () => {
    expect(canTakeQuiz(mockSession({ employeeId: "emp-1" }), "emp-1")).toBe(true);
    expect(canTakeQuiz(mockSession({ employeeId: "emp-2" }), "emp-1")).toBe(false);
    expect(canTakeQuiz(mockSession({ roles: ["HR_ADMIN"] }), "emp-1")).toBe(false);
  });
});

describe("canViewLearningAssignment (Phase 3B role-scoped confidentiality)", () => {
  it("allows HR Admin, Training Admin, the employee themself, their manager, or an active HR Manager", () => {
    expect(canViewLearningAssignment(mockSession({ roles: ["HR_ADMIN"] }), "emp-1", false, [])).toBe(true);
    expect(canViewLearningAssignment(mockSession({ roles: ["TRAINING_ADMIN"] }), "emp-1", false, [])).toBe(true);
    expect(canViewLearningAssignment(mockSession({ employeeId: "emp-1" }), "emp-1", false, [])).toBe(true);
    expect(canViewLearningAssignment(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", true, [])).toBe(true);
    expect(canViewLearningAssignment(mockSession({ roles: ["EMPLOYEE"] }), "emp-1", false, ["pos-hr-manager"])).toBe(true);
  });

  it("denies a bystander", () => {
    expect(canViewLearningAssignment(mockSession({ employeeId: "bystander-1" }), "emp-1", false, [])).toBe(false);
  });
});

describe("canViewCompanyWideLmsReporting", () => {
  it("HR Admin, Training Admin, or an active HR Manager — never a plain employee", () => {
    expect(canViewCompanyWideLmsReporting(mockSession({ roles: ["HR_ADMIN"] }), [])).toBe(true);
    expect(canViewCompanyWideLmsReporting(mockSession({ roles: ["TRAINING_ADMIN"] }), [])).toBe(true);
    expect(canViewCompanyWideLmsReporting(mockSession({ roles: ["EMPLOYEE"] }), ["pos-hr-manager"])).toBe(true);
    expect(canViewCompanyWideLmsReporting(mockSession({ roles: ["EMPLOYEE"] }), [])).toBe(false);
  });
});

describe("Phase 4A asset permissions — GA Admin only, never HR Admin", () => {
  it("canManageAssets/canViewAssetMaster/canImportAssetMaster are GA Admin only", () => {
    for (const fn of [canManageAssets, canViewAssetMaster, canImportAssetMaster]) {
      expect(fn(mockSession({ roles: ["GA_ADMIN"] }))).toBe(true);
      expect(fn(mockSession({ roles: ["HR_ADMIN"] }))).toBe(false);
      expect(fn(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(false);
    }
  });

  it("canViewOwnAssetCustody: only the exact custody employee, never GA/HR Admin", () => {
    expect(canViewOwnAssetCustody(mockSession({ employeeId: "emp-1" }), "emp-1")).toBe(true);
    expect(canViewOwnAssetCustody(mockSession({ employeeId: "emp-2" }), "emp-1")).toBe(false);
    expect(canViewOwnAssetCustody(mockSession({ roles: ["GA_ADMIN"] }), "emp-1")).toBe(false);
  });
});

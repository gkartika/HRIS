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
  canExecuteMovementRequest,
  canCancelMovementRequest,
  canViewOnboarding,
  canMarkOnboardingContract,
  canMarkOnboardingTraining,
  canMarkOnboardingAssets,
  canViewContract,
  canManageContracts,
  canSubmitContractRecommendation,
  canDecideContractRenewal,
  canSignContract,
  canViewEmployeeDocument,
  canUploadEmployeeDocument,
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

describe("canSubmitMovementRequest (LIF-04)", () => {
  it("allows the employee's direct manager", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "manager-1" });
    expect(canSubmitMovementRequest(session, true)).toBe(true);
  });

  it("allows HR Admin even when not the direct manager", () => {
    const session = mockSession({ roles: ["HR_ADMIN"], employeeId: null });
    expect(canSubmitMovementRequest(session, false)).toBe(true);
  });

  it("denies a plain employee who isn't the direct manager", () => {
    const session = mockSession({ roles: ["EMPLOYEE"], employeeId: "bystander-1" });
    expect(canSubmitMovementRequest(session, false)).toBe(false);
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
    expect(canMarkOnboardingAssets(mockSession({ roles: ["GA_ADMIN"] }))).toBe(true);
    expect(canMarkOnboardingAssets(mockSession({ roles: ["TRAINING_ADMIN"] }))).toBe(false);
    expect(canMarkOnboardingAssets(mockSession({ roles: ["HR_ADMIN"] }))).toBe(true);
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

import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { Employee } from "@/generated/prisma/client";
import {
  isHrAdmin,
  isTrainingAdmin,
  isGaAdmin,
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

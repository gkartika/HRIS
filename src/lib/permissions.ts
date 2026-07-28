import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import type { Employee } from "@/generated/prisma/client";

// Backend-enforced RBAC (CTL: "enforce permissions in the backend, not only by
// hiding buttons"). Every server action / route handler that touches HR data
// must call one of these, not just rely on the nav hiding a link.

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export function hasRole(session: Session, role: string): boolean {
  return session.user.roles.includes(role as never);
}

export const isHrAdmin = (session: Session) => hasRole(session, "HR_ADMIN");
export const isTrainingAdmin = (session: Session) => hasRole(session, "TRAINING_ADMIN");
export const isGaAdmin = (session: Session) => hasRole(session, "GA_ADMIN");

// ACC-09: record-level scope. Phase 0 has no manager-vs-report relationship UI
// yet (that's Phase 1's Assignment/org-chart work), so for now "can list all
// employees" is an HR/Training/GA admin capability; a plain employee account
// only ever gets their own record.
export function canListEmployees(session: Session): boolean {
  return isHrAdmin(session) || isTrainingAdmin(session) || isGaAdmin(session);
}

export function canAccessImport(session: Session): boolean {
  // Recruitment/employee import ownership sits with the People & Payroll (HR)
  // admin per the Data Fields Blueprint's Primary Owner column.
  return isHrAdmin(session);
}

export function canAccessAuditLog(session: Session): boolean {
  return isHrAdmin(session);
}

// Org structure (Org Units/Jobs/Positions) and Assignment moves are HR Admin
// operations — this is the People & Payroll Admin's data per the Data Fields
// Blueprint's Primary Owner column for Org Units/Job Master/Position Master.
export function canManageOrgStructure(session: Session): boolean {
  return isHrAdmin(session);
}

export function canManageAssignments(session: Session): boolean {
  return isHrAdmin(session);
}

export function canCreateEmployee(session: Session): boolean {
  return isHrAdmin(session);
}

// ACC-10: field-level scope. Every field on Employee is tagged with the
// sensitivity tier from the Data Fields Blueprint. Rather than nulling values
// (which still leaks "field exists"), we omit the key entirely so the UI
// naturally renders nothing for it.
const HIGHLY_RESTRICTED_FIELDS = [
  "nationalIdNumber",
  "bankAccountName",
  "bankAccountNumber",
  "taxId",
  "bpjsEmploymentNumber",
  "bpjsHealthNumber",
] as const;

const RESTRICTED_CONTACT_FIELDS = [
  "birthPlace",
  "birthDate",
  "personalEmail",
  "currentAddress",
  "emergencyContactName",
  "emergencyContactRelation",
  "emergencyContactPhone",
] as const;

export type EmployeeForList = Partial<Employee> & {
  id: string;
  employeeNumber: string;
  fullLegalName: string;
};

/**
 * Projects an Employee record down to the fields a given session is allowed
 * to see. Self-view (employee viewing their own record) always gets the full
 * record. HR Admin gets the full record for anyone. Training/GA admins get a
 * restricted field set per ACC-03 / ACC-04. Everyone else gets identity-only.
 */
export function projectEmployee(
  employee: Employee,
  session: Session
): Partial<Employee> {
  const isSelf = session.user.employeeId === employee.id;
  if (isSelf || isHrAdmin(session)) {
    return employee;
  }

  const result: Partial<Employee> = { ...employee };
  for (const field of HIGHLY_RESTRICTED_FIELDS) delete result[field];

  if (isTrainingAdmin(session)) {
    for (const field of RESTRICTED_CONTACT_FIELDS) {
      if (field !== "personalEmail") delete result[field];
    }
    delete result.personalEmail;
    delete result.currentAddress;
    delete result.emergencyContactName;
    delete result.emergencyContactRelation;
    delete result.emergencyContactPhone;
    delete result.bankAccountName;
    return result;
  }

  if (isGaAdmin(session)) {
    // Name, number, org placement, employment status only — no PII contact,
    // no financial data (ACC-04 explicitly excludes salary/performance too,
    // which live outside Employee anyway).
    for (const field of RESTRICTED_CONTACT_FIELDS) delete result[field];
    delete result.personalEmail;
    delete result.mobileNumber;
    delete result.workEmail;
    return result;
  }

  // Fallback: identity + org placement only.
  for (const field of RESTRICTED_CONTACT_FIELDS) delete result[field];
  delete result.personalEmail;
  delete result.mobileNumber;
  return result;
}

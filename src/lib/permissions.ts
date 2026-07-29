import type { Session } from "next-auth";
import type { Employee } from "@/generated/prisma/client";

// Backend-enforced RBAC (CTL: "enforce permissions in the backend, not only by
// hiding buttons"). Every server action / route handler that touches HR data
// must call one of these, not just rely on the nav hiding a link.
// Deliberately no Next.js-runtime imports here — see require-session.ts for
// requireSession(), which needs next/navigation + the NextAuth instance.

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

// ACC-13: "Assistant/Department Head may create and submit Recruitment
// Requests for their permitted organization scope." This app has no
// separate "Assistant" account type and Position-scoped authorization is
// out of scope for this simplified flow (DEC-013) — any employee-linked
// account can submit a request, same as HR Admin.
export function canSubmitRecruitmentRequest(session: Session): boolean {
  return isHrAdmin(session) || !!session.user.employeeId;
}

// ACC-14/DEC-015: HR Manager authority is derived live from an active
// Position Assignment (see src/lib/hr-manager.ts's getActiveHrManagerPositions),
// never a stored role — so this predicate takes the already-resolved list of
// currently-active HR Manager Position ids as plain data, keeping this file
// dependency-free/pure for Vitest. A caller with zero active positions
// (assignment never existed, or its effectiveTo has passed) has no HR
// Manager authority, automatically, with no separate "revoke" step needed.
export function isHrManager(activeHrManagerPositionIds: string[]): boolean {
  return activeHrManagerPositionIds.length > 0;
}

// WF-15/ACC-13: "Only the employee occupying an active HR Manager Position
// may approve, return or reject. HR Admin has read-only decision access."
export function canApproveRecruitmentRequest(activeHrManagerPositionIds: string[]): boolean {
  return isHrManager(activeHrManagerPositionIds);
}

// ACC-13/ACC-02: HR Admin creates/links Employees to a request only AFTER
// HR Manager approval (enforced separately by canRequestAcceptFulfillment on
// the request's status) and may also create an Employee directly with no
// request at all (DEC-014, unrelated to this predicate).
export function canCreateEmployeeFromRequest(session: Session): boolean {
  return isHrAdmin(session);
}

// DM-25/ACC-16: cancellation is the explicit exception to "HR Manager alone
// decides" — the original Requester, an active HR Manager, or HR Admin may
// all cancel an eligible (not yet Filled/Closed/Cancelled) request. Status
// eligibility itself is checked separately via canCancelRequestStatus in
// recruitment.ts.
export function canCancelRecruitmentRequest(
  session: Session,
  requesterEmployeeId: string,
  activeHrManagerPositionIds: string[]
): boolean {
  const isRequester = !!session.user.employeeId && session.user.employeeId === requesterEmployeeId;
  return isRequester || isHrManager(activeHrManagerPositionIds) || isHrAdmin(session);
}

// CTL-12 / employee identity documents (KTP, KK, contracts, etc.): "HR Admin
// – People & Payroll has full access. An employee may access only their own
// permitted documents. Managers, Training Admin, GA/Assets Admin and
// technical administrators must not receive automatic access." Upload/
// replace is HR Admin only — self-service is view/download only.
export function canViewEmployeeDocument(session: Session, employeeId: string): boolean {
  return isHrAdmin(session) || session.user.employeeId === employeeId;
}

export function canUploadEmployeeDocument(session: Session): boolean {
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
  // DM-17/DM-18/CTL-12: "No KK, Nama Ibu Kandung, PTKP Pajak, KTP file and KK
  // file are sensitive" — same tier as bank/tax/BPJS above. The relation
  // objects (ptkpStatus/ktpFile/kkFile) aren't part of the base Employee
  // scalar type — their visibility is gated separately at the page level,
  // same pattern already used for currentPosition/assignments/files.
  "noKk",
  "namaIbuKandung",
  "ptkpStatusCode",
  "ktpFileId",
  "kkFileId",
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

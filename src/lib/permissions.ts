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

// Department Manager/Head approval gate (Job level 3B, scoped to the
// request's own department — resolved live via
// src/lib/dept-head.ts's getActiveDeptHeadPositions), added ahead of the HR
// Manager per direct user request. Same shape as isHrManager/
// canApproveRecruitmentRequest — HR Admin has no special access here either,
// matching WF-15's "HR Admin has read-only decision access" for the HR
// Manager step.
export function isDeptHeadApprover(activeDeptHeadPositionIds: string[]): boolean {
  return activeDeptHeadPositionIds.length > 0;
}

export function canApproveRecruitmentRequestAsDeptHead(activeDeptHeadPositionIds: string[]): boolean {
  return isDeptHeadApprover(activeDeptHeadPositionIds);
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

// Perubahan Posisi refactor: submission is now Level-3 (Job level 3A/3B,
// scoped to the requester's own Department) eligibility, not "is this
// employee's direct manager" — isLevel3InDepartment is resolved by the
// caller via src/lib/level3-scope.ts's isLevel3ForEmployeeDepartment
// (Prisma-backed, kept out of this file for the same dependency-free-for-
// Vitest reason as isHrManager above). HR Admin may also submit directly,
// same administrative latitude it already has for Employee creation
// (DEC-014).
export function canSubmitMovementRequest(session: Session, isLevel3InDepartment: boolean): boolean {
  return isHrAdmin(session) || isLevel3InDepartment;
}

// Perubahan Posisi refactor: Department Head 3B approval gate (first
// stage), same shape as Recruitment's canApproveRecruitmentRequestAsDeptHead
// — HR Admin has no special access here either (notified only, per the
// access spec).
export function canApproveMovementRequestAsDeptHead(activeDeptHeadPositionIds: string[]): boolean {
  return activeDeptHeadPositionIds.length > 0;
}

// LIF-04: "HR Manager approves or rejects the movement" (final stage) —
// same Position-derived-only authority as Recruitment (WF-15), reused here
// for consistency.
export function canApproveMovementRequest(activeHrManagerPositionIds: string[]): boolean {
  return isHrManager(activeHrManagerPositionIds);
}

// LIF-04: "HR Admin executes the future/effective-dated Position
// Assignment" — only after HR Manager has approved (enforced separately via
// canExecuteMovementRequestStatus on the request's status).
export function canExecuteMovementRequest(session: Session): boolean {
  return isHrAdmin(session);
}

// Perubahan Posisi refactor: "Prevent self-approval" — neither approval
// stage may be decided by the request's own Requester, even if they
// otherwise hold a qualifying Position (Dept Head 3B or HR Manager) for
// this department. Pure/session-agnostic so both decideMovementRequest and
// decideMovementRequestAsDeptHead share the exact same check.
export function isSelfApprovalAttempt(actingEmployeeId: string | null | undefined, requesterEmployeeId: string): boolean {
  return !!actingEmployeeId && actingEmployeeId === requesterEmployeeId;
}

// Same DM-25-style exception as Recruitment cancellation: the original
// Requester (the submitting manager), an active HR Manager, or HR Admin may
// cancel an eligible Movement Request.
export function canCancelMovementRequest(
  session: Session,
  requesterEmployeeId: string,
  activeHrManagerPositionIds: string[]
): boolean {
  const isRequester = !!session.user.employeeId && session.user.employeeId === requesterEmployeeId;
  return isRequester || isHrManager(activeHrManagerPositionIds) || isHrAdmin(session);
}

// LIF-03/Data Fields Blueprint "12 Onboarding": "Shared onboarding across
// People & Payroll, Training and Assets accounts" — visibility is "Admin
// shared", not self-view (unlike Employee Master), plus the HR Manager per
// ACC-15/DSH-13 ("HR Manager sees onboarding progress... in personal
// dashboard").
export function canViewOnboarding(session: Session, activeHrManagerPositionIds: string[]): boolean {
  return isHrAdmin(session) || isTrainingAdmin(session) || isGaAdmin(session) || isHrManager(activeHrManagerPositionIds);
}

// Each completion flag has its own Primary Owner in the blueprint; HR Admin
// (People & Payroll) can also mark any of them, consistent with its broader
// operational latitude elsewhere in this app.
export function canMarkOnboardingContract(session: Session): boolean {
  return isHrAdmin(session);
}
export function canMarkOnboardingTraining(session: Session): boolean {
  return isHrAdmin(session) || isTrainingAdmin(session);
}
export function canMarkOnboardingAssets(session: Session): boolean {
  return isHrAdmin(session) || isGaAdmin(session);
}

// Data Fields Blueprint "08 Contracts": Visibility "Self + People Admin" —
// the employee sees only their own contracts, HR Admin sees any. Used for
// the summary list on the Employee profile page.
export function canViewContract(session: Session, employeeId: string): boolean {
  return isHrAdmin(session) || session.user.employeeId === employeeId;
}

// The contract *detail* page also needs to be reachable by whoever must act
// on it mid-workflow — the employee's direct manager (to submit the
// Department Manager recommendation) and the active HR Manager (to decide
// Renew/Not Renew) — neither of whom is "self" or HR Admin. Missing this
// widening would silently lock both of them out of a page they need to use.
export function canViewContractDetail(
  session: Session,
  employeeId: string,
  activeHrManagerPositionIds: string[],
  isEmployeesManager: boolean
): boolean {
  return canViewContract(session, employeeId) || isHrManager(activeHrManagerPositionIds) || isEmployeesManager;
}

// Contracts' Primary Owner is People & Payroll Admin throughout — creating
// the baseline contract, starting a review, and preparing/releasing/
// administering a renewal are all HR-Admin-only (LIF-09: "HR Admin
// prepares, releases and administers").
export function canManageContracts(session: Session): boolean {
  return isHrAdmin(session);
}

// LIF-09: "Department Manager recommendation" — the employee's own direct
// manager, resolved live via src/lib/manager-scope.ts (same pattern as
// canSubmitMovementRequest). HR Admin may also submit on behalf, same
// administrative latitude as elsewhere in this app.
export function canSubmitContractRecommendation(session: Session, isEmployeesManager: boolean): boolean {
  return isHrAdmin(session) || isEmployeesManager;
}

// LIF-09: "HR Manager review and Renew/Not Renew decision" — same
// Position-derived-only authority as Recruitment (WF-15) and Movement.
export function canDecideContractRenewal(activeHrManagerPositionIds: string[]): boolean {
  return isHrManager(activeHrManagerPositionIds);
}

// Blueprint: signed_at's Primary Owner is "Employee" — only the employee
// covered by the contract signs it, never HR Admin on their behalf.
export function canSignContract(session: Session, employeeId: string): boolean {
  return session.user.employeeId === employeeId;
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

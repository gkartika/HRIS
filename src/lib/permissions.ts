import type { Session } from "next-auth";
import type { Employee } from "@/generated/prisma/client";
import type { AttendanceMethod } from "@/generated/prisma/enums";

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
  // admin per the Data Fields Blueprint's Primary Owner column — Training
  // Admin and GA Admin are admitted too, solely for their own scoped
  // dataset entries (mandatory-training-participants/training-attendance,
  // asset-master respectively); the hub page itself filters which upload
  // forms each role actually sees.
  return isHrAdmin(session) || isTrainingAdmin(session) || isGaAdmin(session);
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

// Emergency account suspension ("put on hold") — a lighter-weight action
// than full Offboarding exit-clearance: it only blocks login, it never ends
// Assignments/Contracts or changes Employee.activeFlag. HR Admin or an
// active HR Manager may use it, same actor set as most decision stages.
export function canManageAccountHold(session: Session, activeHrManagerPositionIds: string[]): boolean {
  return isHrAdmin(session) || isHrManager(activeHrManagerPositionIds);
}

// Creating a login for an employee and emailing the invitation / password
// reset link — Admin SDM only (HR Manager can hold/reactivate, not issue logins).
export function canManageAccountAccess(session: Session): boolean {
  return isHrAdmin(session);
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

// Manual entry point for an existing Employee who never got an Onboarding
// Case automatically (e.g. legacy/imported data) — People & Payroll owns
// this the same way it owns marking the flags below.
export function canCreateOnboardingCase(session: Session): boolean {
  return isHrAdmin(session);
}

// Each completion flag has its own Primary Owner in the blueprint; HR Admin
// (People & Payroll) can also mark any of them, consistent with its broader
// operational latitude elsewhere in this app. The training flag is the one
// exception: Training Admin is the domain's sole operational owner
// (2026-08-18), so HR Admin does not get the usual fallback here.
export function canMarkOnboardingContract(session: Session): boolean {
  return isHrAdmin(session);
}
export function canMarkOnboardingTraining(session: Session): boolean {
  return isTrainingAdmin(session);
}

// Data Fields Blueprint "08 Contracts": Visibility "Self + People Admin" —
// the employee sees only their own contracts, HR Admin sees any. Used for
// the summary list on the Employee profile page.
export function canViewContract(session: Session, employeeId: string): boolean {
  return isHrAdmin(session) || session.user.employeeId === employeeId;
}

// The contract *detail* page also needs to be reachable by whoever must act
// on it mid-workflow — the employee's direct manager (to submit the old
// manual Department Manager recommendation), the active HR Manager (to
// decide Renew/Not Renew), and an active Dept Head 3B for the employee's
// own department (to submit the D-30 Renewal Case's own recommendation) —
// none of whom is "self" or HR Admin. The Dept Head widening matters even
// when nobody is that employee's literal isDirectManagerOfEmployee — e.g.
// the Dept Head's *own* renewal case has no one reporting to them directly,
// but another active 3B holder in the same department must still reach
// this page to decide it. Missing any of these would silently lock that
// person out of a page they need to use (same class of bug as
// recruitment/[id]/page.tsx's original isHrManagerNow gap).
export function canViewContractDetail(
  session: Session,
  employeeId: string,
  activeHrManagerPositionIds: string[],
  isEmployeesManager: boolean,
  activeDeptHeadPositionIds: string[] = []
): boolean {
  return (
    canViewContract(session, employeeId) ||
    isHrManager(activeHrManagerPositionIds) ||
    isEmployeesManager ||
    isDeptHeadApprover(activeDeptHeadPositionIds)
  );
}

// Contracts' Primary Owner is People & Payroll Admin throughout — creating
// the baseline contract, starting a review, drafting/signing/administering a
// renewal are all HR-Admin-only (LIF-09: "HR Admin prepares, releases and
// administers"). Release is the one exception — see
// canApproveContractRelease below.
export function canManageContracts(session: Session): boolean {
  return isHrAdmin(session);
}

// Per direct user request: releasing a Draft contract to the employee now
// needs an active HR Manager Position's approval, not HR Admin alone — same
// Position-derived-only authority as every other HR Manager decision in
// this app. Applies uniformly to every Contract sitting at DRAFT, however
// it got there (manually created by HR Admin, or auto-generated by an
// approved Contract Renewal Case).
export function canApproveContractRelease(activeHrManagerPositionIds: string[]): boolean {
  return isHrManager(activeHrManagerPositionIds);
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

// BPJS TK/Kesehatan cards: broader view access than other employee documents
// — GA Admin and Training Admin need to pull an employee's card on hand
// (e.g. HSE handling a workplace accident), but only HR Admin can
// upload/replace one. Kept separate from canViewEmployeeDocument since that
// function's self-or-HR-Admin-only rule still applies to every other
// employee document category.
export function canViewBpjsCard(session: Session, employeeId: string): boolean {
  return (
    isHrAdmin(session) ||
    isGaAdmin(session) ||
    isTrainingAdmin(session) ||
    session.user.employeeId === employeeId
  );
}

// ---------- Shared Evaluation (DM-26/27, WF-19, ACC-17, PER-07, DEC-020) ----------
// One reusable FR-HC-01-07 workflow for every consumer — Contract Renewal
// (draft at D-30), Perubahan Posisi (draft on Promosi/Mutasi/Demosi
// submission) and HR-Admin-initiated Manual HR evaluations. HR Admin alone
// creates Manual drafts and releases every evaluation regardless of source;
// the two assigned evaluators (P1/P2) each see only their own slot; the
// primary Dept Head and HR Manager see completed results only when their
// own source workflow requires it.

// ACC-17: "HR Admin... is the only role that can assign P1/P2 and release
// any evaluation" — also covers Manual HR draft creation.
export function canCreateManualEvaluation(session: Session): boolean {
  return isHrAdmin(session);
}

export function canReleaseEvaluation(session: Session): boolean {
  return isHrAdmin(session);
}

// ACC-17: "P1/P2 may view and edit only their own assigned slot" — the
// acting session must literally be the specific employee assigned to that
// slot, not just any Level-3 holder or manager.
export function canSubmitEvaluationAs(
  actingEmployeeId: string | null | undefined,
  assignedEvaluatorEmployeeId: string | null
): boolean {
  return !!actingEmployeeId && !!assignedEvaluatorEmployeeId && actingEmployeeId === assignedEvaluatorEmployeeId;
}

// ACC-11/LIF-09: "The primary Department Head reviews completed results and
// recommends" — same Level-3B-of-department gate as Perubahan Posisi
// (dept-head.ts's getActiveDeptHeadPositions), reused here rather than the
// direct-report canSubmitContractRecommendation predicate the older manual
// Contract pipeline still uses.
export function canSubmitRenewalDeptHeadRecommendation(activeDeptHeadPositionIds: string[]): boolean {
  return isDeptHeadApprover(activeDeptHeadPositionIds);
}

// ACC-11/ACC-16: "HR Manager uses the personal Position-based account to
// approve, return, reject or change the recommendation... HR Admin has no
// approval control." Same Position-derived-only authority as every other
// HR Manager decision in this app.
export function canDecideContractRenewalCase(activeHrManagerPositionIds: string[]): boolean {
  return isHrManager(activeHrManagerPositionIds);
}

// ACC-17: evaluation detail visibility — HR Admin, either assigned
// evaluator (own slot only — field-level hiding of the *other* evaluator's
// scores still happens at the page level), the primary Dept Head and HR
// Manager "may view completed results only when required by their
// workflow" (approximated here as: holds the role at all; the page itself
// only renders scores once the evaluation is Completed for these two).
// The subject employee themself is deliberately NOT included — ACC-11/17
// give them status only, never score access.
export function canViewEvaluation(
  session: Session,
  actingEmployeeId: string | null | undefined,
  p1EmployeeId: string | null,
  p2EmployeeId: string | null,
  activeDeptHeadPositionIds: string[],
  activeHrManagerPositionIds: string[]
): boolean {
  return (
    isHrAdmin(session) ||
    canSubmitEvaluationAs(actingEmployeeId, p1EmployeeId) ||
    canSubmitEvaluationAs(actingEmployeeId, p2EmployeeId) ||
    isDeptHeadApprover(activeDeptHeadPositionIds) ||
    isHrManager(activeHrManagerPositionIds)
  );
}

// ---------- Offboarding (LIF-06/07/12, WF-10, GA-05, DSH-08/09/14) ----------

// HR Admin alone opens an offboarding case (per direct user request) — no
// manager report, no Dept Head / HR Manager approval.
export function canStartOffboarding(session: Session): boolean {
  return isHrAdmin(session);
}

// LIF-06: "HR Admin exit-clearance execution > Account Disable" — Primary
// Owner is People & Payroll Admin, same latitude as canManageContracts.
export function canExecuteExitClearance(session: Session): boolean {
  return isHrAdmin(session);
}

export function canCancelOffboardingCase(session: Session): boolean {
  return isHrAdmin(session);
}

// Visibility for the case detail/list: HR Admin and the leaving employee
// themself — nobody else. GA Admin has its own asset-clearance page
// (offboarding/asset-clearance) and never opens the full case.
export function canViewOffboardingCase(session: Session, employeeId: string): boolean {
  return isHrAdmin(session) || session.user.employeeId === employeeId;
}

// Version after UAT: employee-facing Exit Clearance form — self-service
// only, no admin latitude (this is the employee's own attestation, not
// something HR Admin fills in on their behalf).
export function canSubmitExitClearanceForm(session: Session, employeeId: string): boolean {
  return session.user.employeeId === employeeId;
}

// Admin-configurable question bank behind the form above — People & Payroll
// Admin owns this the same way it owns every other admin-configurable
// master list (Education Levels, PTKP Status).
export function canManageExitClearanceQuestions(session: Session): boolean {
  return isHrAdmin(session);
}

// GA Admin's explicit sign-off that every asset/GA request tied to the
// employee has been returned/closed — required alongside (not instead of)
// the automatic AssetCustody/GaRequest checks in executeExitClearance().
export function canConfirmGaAssetClearance(session: Session): boolean {
  return isGaAdmin(session);
}

// ---------- Shift Assignment (new, per direct user request) ----------

// Weekly submission authority — same Level-3 (3A/3B, scoped to the
// employee's own department) eligibility already used for Perubahan Posisi
// submission (src/lib/level3-scope.ts's isLevel3ForEmployeeDepartment), plus
// HR Admin's usual administrative latitude to submit/override directly.
export function canSubmitShiftAssignment(session: Session, isLevel3InDepartment: boolean): boolean {
  return isHrAdmin(session) || isLevel3InDepartment;
}

// ---------- Phase 2 Extension: Attendance & Absence ----------

// AttendanceGeofence/AbsenceApproverConfig/AbsenceEntitlementConfig admin
// master data — HR Admin only, same EducationLevel/PtkpStatus admin-list
// pattern used elsewhere. There is no per-employee work schedule to manage —
// every employee shares the one fixed company default (lib/attendance.ts).
export function canManageAttendanceMasterData(session: Session): boolean {
  return isHrAdmin(session);
}

// Per-employee, effective-dated Method (+ Geofence) assignment — HR Admin
// only, same latitude as canManageAssignments.
export function canManageAttendanceAssignment(session: Session): boolean {
  return isHrAdmin(session);
}

// Mobile GPS+selfie check-in/out is strictly self-service, and only for an
// employee whose current AttendanceAssignment.method is MOBILE — a
// FINGERPRINT-assigned employee (or one with no assignment yet) has no
// manual action here at all, matching the spec's "Fingerprint employee has
// no mobile action" checkpoint. attendanceMethod is resolved live by the
// caller (the employee's current AttendanceAssignment), kept as plain data
// so this predicate stays dependency-free for Vitest.
export function canRecordOwnAttendance(
  session: Session,
  employeeId: string,
  attendanceMethod: AttendanceMethod | null
): boolean {
  return session.user.employeeId === employeeId && attendanceMethod === "MOBILE";
}

// Bespoke Fingerprint XLSX/CSV bulk import — People & Payroll Admin owns
// every import in this app (canAccessImport), reused here as its own named
// predicate since it gates a distinct action (fingerprint import specifically,
// not the generic dataset registry).
export function canImportFingerprintAttendance(session: Session): boolean {
  return isHrAdmin(session);
}

// Visibility for Attendance records/exceptions: HR Admin, the employee
// themself (self-view, same as Contract/Shift Assignment), or their Level-3
// (3A/3B, own department — src/lib/level3-scope.ts) for team visibility.
export function canViewAttendance(session: Session, employeeId: string, isLevel3InDepartment: boolean): boolean {
  return isHrAdmin(session) || session.user.employeeId === employeeId || isLevel3InDepartment;
}

export function canExportAttendanceData(session: Session): boolean {
  return isHrAdmin(session);
}

// Absence submission is self-service, or HR Admin submitting on the
// employee's behalf (spec: "employee/HR-Admin-offline submission" — e.g. a
// factory-floor employee without app access phoning in a Sakit report).
export function canSubmitAbsenceRequest(session: Session, employeeId: string): boolean {
  return isHrAdmin(session) || session.user.employeeId === employeeId;
}

// First-approval stage: whichever Position is configured for the employee's
// Department (AbsenceApproverConfig) at submission time — the acting
// session must be a *current holder* of that specific Position, resolved
// live by the caller (Position.currentHolders-style query), not a
// department-wide Level-3/Dept-Head derivation like the other workflows.
export function canDecideAbsenceRequestAsFirstApprover(
  actingEmployeeId: string | null | undefined,
  approverPositionHolderEmployeeIds: string[]
): boolean {
  return !!actingEmployeeId && approverPositionHolderEmployeeIds.includes(actingEmployeeId);
}

// Identical check as the first stage (same "is this employee among the
// configured Position's current holders" logic as canDecideAsConfiguredGaApprover
// below) — kept as its own exported name so call sites read as "second
// approver" rather than reusing the first-stage name under a different
// meaning.
export const canDecideAbsenceRequestAsSecondApprover = canDecideAbsenceRequestAsFirstApprover;

// Final stage — HR Admin only, no HR Manager step in this workflow.
export function canDecideAbsenceRequestAsHrAdmin(session: Session): boolean {
  return isHrAdmin(session);
}

// In-place correction of an already-decided request — same actor as the
// final decision stage.
export function canOverrideAbsenceRequest(session: Session): boolean {
  return isHrAdmin(session);
}

// Same DM-25-style exception as every other cancellation in this app: the
// subject employee, whoever submitted it, or HR Admin.
export function canCancelAbsenceRequest(session: Session, employeeId: string, submittedByAccountId: string): boolean {
  const isSubject = !!session.user.employeeId && session.user.employeeId === employeeId;
  const isSubmitter = session.user.id === submittedByAccountId;
  return isHrAdmin(session) || isSubject || isSubmitter;
}

// Visibility: HR Admin, the subject employee, their Level-3 (own
// department), or either configured approver Position's current holder.
export function canViewAbsenceRequest(
  session: Session,
  employeeId: string,
  isLevel3InDepartment: boolean,
  approverPositionHolderEmployeeIds: string[],
  secondApproverPositionHolderEmployeeIds: string[] = []
): boolean {
  return (
    isHrAdmin(session) ||
    session.user.employeeId === employeeId ||
    isLevel3InDepartment ||
    canDecideAbsenceRequestAsFirstApprover(session.user.employeeId, approverPositionHolderEmployeeIds) ||
    canDecideAbsenceRequestAsSecondApprover(session.user.employeeId, secondApproverPositionHolderEmployeeIds)
  );
}

export function canExportAbsenceData(session: Session): boolean {
  return isHrAdmin(session);
}

// Task Force membership — HR Admin only, same administrative latitude as
// Account Hold / Attendance Assignment elsewhere on the Employee page.
export function canManageTaskForceMembership(session: Session): boolean {
  return isHrAdmin(session);
}

// ---------- Phase 3A: Competency (COM-06/10/15/17, ACC-03/21/24) ----------

// ACC-21: Director authority for Level-3-employee P1 routing and Level-3
// gap reporting — same Position-derived-only shape as isHrManager/
// isDeptHeadApprover (resolved live via org-chart.ts's
// getActiveDirectorCandidates, never a stored flag).
export function isDirector(activeDirectorPositionIds: string[]): boolean {
  return activeDirectorPositionIds.length > 0;
}

// 2026-08-18: Training & Competency Admin is the sole operational owner of
// the whole Training & Competency domain — HR Admin's usual administrative
// latitude is deliberately withheld here, same wall-off shape as GA Admin
// owns Assets/GA with HR Admin excluded.
export function canManageCompetencyFramework(session: Session): boolean {
  return isTrainingAdmin(session);
}

export function canOpenCompetencyCycle(session: Session): boolean {
  return isTrainingAdmin(session);
}

// ACC-21: "P1 is the Primary Position supervisor and completes the
// competency levels plus Company Values." Acting session must literally be
// the assigned P1 employee — same shape as evaluation.ts's
// canSubmitEvaluationAs, this being the direct Phase 3A analog.
export function canScoreAsCompetencyP1(actingEmployeeId: string | null | undefined, p1EmployeeId: string | null): boolean {
  return !!actingEmployeeId && !!p1EmployeeId && actingEmployeeId === p1EmployeeId;
}

// ACC-21: "P2 is the Department Head [or, for a Level 3 subject, the HR
// Manager] and completes Company Values" — independent of P1's submission.
export function canScoreAsCompetencyP2(actingEmployeeId: string | null | undefined, p2EmployeeId: string | null): boolean {
  return !!actingEmployeeId && !!p2EmployeeId && actingEmployeeId === p2EmployeeId;
}

// 2026-08-18: reassignment authority moved from HR Admin to Training Admin
// along with the rest of the domain — still deliberately does NOT also
// grant canScoreAsCompetencyP1/P2 above, same separation-of-duties shape as
// before, just with Training Admin now on both sides of that line.
export function canReassignCompetencyEvaluator(session: Session): boolean {
  return isTrainingAdmin(session);
}

// COM-10/ACC-21: "Employees may see only their own finalized results" — the
// subject employee never sees an in-progress assessment, matching ACC-17's
// "requesters see status only" pattern for the shared Evaluation entity.
export function canViewOwnCompetencyResult(session: Session, subjectEmployeeId: string, completedAt: Date | null): boolean {
  return !!session.user.employeeId && session.user.employeeId === subjectEmployeeId && completedAt !== null;
}

// COM-10/ACC-21: full assessment visibility — Training & Competency Admin,
// either assigned evaluator (own slot; the OTHER evaluator's scores stay
// hidden at the page level while their slot is unsubmitted, same as
// canViewEvaluation), the subject's own finalized result, the subject's
// Department Level 3 (department gap report, COM-10) and the Director
// (Level 3 gap report, COM-10). HR Admin deliberately excluded — see the
// domain-ownership note above canManageCompetencyFramework.
export function canViewCompetencyAssessment(
  session: Session,
  subjectEmployeeId: string,
  p1EmployeeId: string | null,
  p2EmployeeId: string | null,
  completedAt: Date | null,
  isLevel3InSubjectDepartment: boolean,
  activeDirectorPositionIds: string[]
): boolean {
  return (
    isTrainingAdmin(session) ||
    canScoreAsCompetencyP1(session.user.employeeId, p1EmployeeId) ||
    canScoreAsCompetencyP2(session.user.employeeId, p2EmployeeId) ||
    canViewOwnCompetencyResult(session, subjectEmployeeId, completedAt) ||
    isLevel3InSubjectDepartment ||
    isDirector(activeDirectorPositionIds)
  );
}

// 2026-08-18: run authority for the one-time historical migration moved to
// Training Admin along with the rest of the domain — it's now the same
// canManageCompetencyFramework-style admin branch as everything else here,
// no more split between "runs it" (HR Admin) and "reviews it" (Training
// Admin).
export function canRunCompetencyHistoricalMigration(session: Session): boolean {
  return isTrainingAdmin(session);
}

// Phase 3B "Provide import preview for mandatory participant lists and
// in-person attendance" — Training Admin owns both, exclusively (2026-08-18).
export function canImportMandatoryTrainingParticipants(session: Session): boolean {
  return isTrainingAdmin(session);
}

export function canImportTrainingAttendance(session: Session): boolean {
  return isTrainingAdmin(session);
}

// ---------- Phase 3A: Training (TRN-02/09/10/13, ACC-22/23) ----------

// TRN-09/ACC-22: "An Employee may submit a request for self, and a Level 3
// Position may submit for employees in its Department." 2026-08-18: HR
// Admin's administrative submit-on-behalf latitude was withdrawn along with
// the rest of the domain — submission is now Self or Level 3 only (Training
// Admin was never on this list either; it validates/schedules, not submits).
export function canSubmitTrainingRequest(_session: Session, isSelf: boolean, isLevel3InEmployeeDepartment: boolean): boolean {
  return isSelf || isLevel3InEmployeeDepartment;
}

// TRN-10/ACC-22: "The Department Head approves first" — same Position-
// derived gate as every other Department Head approval stage in this app.
export function canDecideTrainingRequestAsDeptHead(activeDeptHeadPositionIds: string[]): boolean {
  return isDeptHeadApprover(activeDeptHeadPositionIds);
}

// TRN-10/ACC-22: "Training Admin then validates, schedules and administers
// delivery." — exclusively, as of 2026-08-18 (HR Admin withdrawn).
export function canValidateTrainingRequest(session: Session): boolean {
  return isTrainingAdmin(session);
}

export function canScheduleTrainingRequest(session: Session): boolean {
  return isTrainingAdmin(session);
}

// TRN-10: "Returned/rejected/cancelled reasons are mandatory and audited" —
// same DM-25-style cancel-eligibility shape used elsewhere, but with HR
// Admin withdrawn (2026-08-18): the original Requester or Training Admin,
// matching GA Requests' {requester} ∪ {domain admin} shape exactly.
export function canCancelTrainingRequest(session: Session, isRequester: boolean): boolean {
  return isTrainingAdmin(session) || isRequester;
}

// ACC-22: "Training Admin may create courses and sessions manually" and
// administers the resulting LearningAssignment lifecycle (attendance,
// completion, certificate) — exclusively, as of 2026-08-18.
export function canManageTrainingCourse(session: Session): boolean {
  return isTrainingAdmin(session);
}

export function canManageLearningAssignment(session: Session): boolean {
  return isTrainingAdmin(session);
}

// ---------- Phase 3B: Learning Library / LMS ----------

// Key Control "Employee sees only their own learning" — a quiz attempt is
// always taken by the exact assigned Employee, never on their behalf by a
// manager or admin (server-side scoring still applies regardless of who
// clicks submit, but only the learner is allowed to).
export function canTakeQuiz(session: Session, assignmentEmployeeId: string): boolean {
  return !!session.user.employeeId && session.user.employeeId === assignmentEmployeeId;
}

// Key Control "Role-scoped confidentiality": Employee sees only their own
// learning; a manager sees only employees within their authority (direct
// report or Level-3 department scope, resolved by the caller the same way
// every other manager-scoped view in this app is); Training Admin sees
// everything (HR Admin withdrawn, 2026-08-18); HR Manager gets the same
// access for its own dedicated company-wide *read-only* reporting view
// (ACC-15-style persona, distinct from the operational Training Admin
// workspace).
export function canViewLearningAssignment(
  session: Session,
  employeeId: string,
  isManagerOfEmployee: boolean,
  activeHrManagerPositionIds: string[]
): boolean {
  return (
    isTrainingAdmin(session) ||
    session.user.employeeId === employeeId ||
    isManagerOfEmployee ||
    isHrManager(activeHrManagerPositionIds)
  );
}

// ACC-15-style: HR Manager's personal company-wide LMS reporting is
// read-only (no course/assignment/attendance/certificate management —
// that stays Training-Admin-only per Key Control "Training Admin owns
// content"), gated on the same live-resolved HR Manager Position Assignment
// as the rest of that persona's workspace. HR Admin withdrawn, 2026-08-18.
export function canViewCompanyWideLmsReporting(session: Session, activeHrManagerPositionIds: string[]): boolean {
  return isTrainingAdmin(session) || isHrManager(activeHrManagerPositionIds);
}

// TRN-04: "the Primary Position supervisor completes it [the effectiveness
// follow-up]" — the assigned Employee's live-resolved supervisor, or
// Training Admin with the domain's administrative latitude (HR Admin's
// equivalent latitude was withdrawn 2026-08-18, moved here along with the
// rest of the domain).
export function canRecordLearningEffectiveness(session: Session, isEmployeesSupervisor: boolean): boolean {
  return isTrainingAdmin(session) || isEmployeesSupervisor;
}

// TRN-13/ACC-23: Mandatory Training rule authoring is Training Admin's
// operational data, exclusively (2026-08-18), same as course/session
// creation.
export function canManageMandatoryTrainingRule(session: Session): boolean {
  return isTrainingAdmin(session);
}

// TRN-02/ACC-22: view access to a single Training Request — Training Admin,
// the subject Employee, whoever submitted it, or an eligible Department
// Head approver. Same shape as canViewAbsenceRequest. HR Admin withdrawn,
// 2026-08-18.
export function canViewTrainingRequest(
  session: Session,
  subjectEmployeeId: string,
  submittedByAccountId: string,
  activeDeptHeadPositionIds: string[]
): boolean {
  return (
    isTrainingAdmin(session) ||
    session.user.employeeId === subjectEmployeeId ||
    session.user.id === submittedByAccountId ||
    isDeptHeadApprover(activeDeptHeadPositionIds)
  );
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
  // DM-17/DM-18/CTL-12: "No KK, Nama Ibu Kandung, PTKP Pajak are sensitive" —
  // same tier as bank/tax/BPJS above. The relation object (ptkpStatus) isn't
  // part of the base Employee scalar type — its visibility is gated
  // separately at the page level, same pattern used for
  // currentPosition/assignments/files/bpjsTkFile/bpjsKesehatanFile.
  "noKk",
  "namaIbuKandung",
  "ptkpStatusCode",
] as const;

const RESTRICTED_CONTACT_FIELDS = [
  "birthPlace",
  "birthDate",
  "personalEmail",
  "currentAddressLine",
  "currentAddressRtRw",
  "currentAddressCity",
  "currentAddressDistrict",
  "currentAddressVillage",
  "currentAddressPostalCode",
  "idCardAddressSameAsCurrent",
  "idCardAddressLine",
  "idCardAddressRtRw",
  "idCardAddressCity",
  "idCardAddressDistrict",
  "idCardAddressVillage",
  "idCardAddressPostalCode",
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
    return result;
  }

  // Fallback: identity + org placement only.
  for (const field of RESTRICTED_CONTACT_FIELDS) delete result[field];
  delete result.personalEmail;
  delete result.mobileNumber;
  return result;
}

// ---------- Phase 4A: Employee Assets ----------
// Access boundary, explicit in the workflow spec: "GA Admin operates asset
// records... HR Admin receives only onboarding/offboarding completion or
// blocker status and cannot create, assign, return or edit GA records." So
// unlike almost every other domain in this app, HR Admin is deliberately
// NOT included in any of these — GA Admin only.

export function canManageAssets(session: Session): boolean {
  return isGaAdmin(session);
}

// Same predicate today (both are GA-Admin-only), kept as a separate name
// since "who may browse the Asset Master/custody records" and "who may
// mutate them" are conceptually distinct questions even though this build
// answers them identically.
export function canViewAssetMaster(session: Session): boolean {
  return isGaAdmin(session);
}

export function canImportAssetMaster(session: Session): boolean {
  return isGaAdmin(session);
}

// ---------- Phase 4B: GA Operations ----------
// Same explicit deviation as Phase 4A above, restated because it's easy to
// get wrong here specifically: GA Admin owns every mutation (verify/route/
// process a request, create/execute maintenance, create/execute disposal,
// configure approval Positions). HR Admin is NOT included in any of these
// predicates — "HR Admin has no GA operational access" per the PDF.

export function canManageGaOperations(session: Session): boolean {
  return isGaAdmin(session);
}

// Consumables (APD/ATK) are a GA Admin back-office ledger: only GA Admin records, edits or
// reads the ledger, and HR Admin has no access, same boundary as above. The one employee-facing
// view is on Perlengkapan Saya: each employee sees their own taken items, read-only, and nothing else.
export function canManageConsumables(session: Session): boolean {
  return isGaAdmin(session);
}

// Submission is self-service only — any employee-linked account may report
// a need, damage or loss for themselves. No HR-Admin-on-behalf-of exception
// here (unlike Absence): the PDF's requester lane is the employee/GA-user
// lane, not an HR proxy path.
export function canSubmitGaRequest(session: Session): boolean {
  return !!session.user.employeeId;
}

// "Requester sees only own requests" — GA Admin (full operational access),
// the original requester, or GA Admin — approval decisions have no separate
// configured-Position holder anymore (GA Admin decides all three stages
// directly), so viewing follows the same two-way rule as every action on
// this request.
export function canViewGaRequest(session: Session, requesterEmployeeId: string): boolean {
  return isGaAdmin(session) || (!!session.user.employeeId && session.user.employeeId === requesterEmployeeId);
}

// Same DM-25-style exception as every other cancellation in this app: the
// original requester or GA Admin.
export function canCancelGaRequest(session: Session, requesterEmployeeId: string): boolean {
  return isGaAdmin(session) || (!!session.user.employeeId && session.user.employeeId === requesterEmployeeId);
}

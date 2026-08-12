// Pure business logic for Phase 3A Training operations (TRN-02, TRN-04,
// TRN-10). No Prisma/Next imports — unit testable, same pattern as
// competency.ts/evaluation.ts.
import type { TrainingRequestStatus, LearningAssignmentStatus } from "@/generated/prisma/enums";

export function formatTrainingRequestNumber(sequence: number, year: number): string {
  return `TRN-${year}-${String(sequence).padStart(4, "0")}`;
}

// TRN-02: "Optional Gap Reference or other reason > Training Request >
// Department Head Approval > Training Admin Validation/Scheduling >
// Assignment > Attendance/Completion > Effectiveness when required."
const CANCELLABLE_TRAINING_REQUEST_STATUSES: TrainingRequestStatus[] = ["SUBMITTED", "DEPT_HEAD_APPROVED", "VALIDATED"];
const TERMINAL_TRAINING_REQUEST_STATUSES: TrainingRequestStatus[] = ["REJECTED", "SCHEDULED", "CANCELLED"];

export function canDeptHeadDecideTrainingRequest(status: TrainingRequestStatus): boolean {
  return status === "SUBMITTED";
}

// TRN-10: "Training Admin validates the request, selects or creates the
// course/session, schedules it and assigns the Employee" — modeled as two
// sequential Training Admin steps (validate, then schedule+assign) so a
// course/session can be picked before a specific date is committed to.
export function canTrainingAdminValidateTrainingRequest(status: TrainingRequestStatus): boolean {
  return status === "DEPT_HEAD_APPROVED";
}

export function canTrainingAdminScheduleTrainingRequest(status: TrainingRequestStatus): boolean {
  return status === "VALIDATED";
}

export function canCancelTrainingRequest(status: TrainingRequestStatus): boolean {
  return CANCELLABLE_TRAINING_REQUEST_STATUSES.includes(status);
}

export function isTerminalTrainingRequestStatus(status: TrainingRequestStatus): boolean {
  return TERMINAL_TRAINING_REQUEST_STATUSES.includes(status);
}

// TRN-04: "Each course has effectiveness_required Yes/No. When Yes, default
// follow-up is D+30 and the interval remains configurable."
export const DEFAULT_EFFECTIVENESS_FOLLOWUP_DAYS = 30;

export function computeEffectivenessDueDate(completedAt: Date, followupDays: number): Date {
  const due = new Date(completedAt);
  due.setDate(due.getDate() + followupDays);
  return due;
}

export function canConfirmLearningAssignmentAttendance(status: LearningAssignmentStatus): boolean {
  return status === "ASSIGNED";
}

export function canCompleteLearningAssignment(status: LearningAssignmentStatus): boolean {
  return status === "ATTENDED";
}

export function canCancelLearningAssignment(status: LearningAssignmentStatus): boolean {
  return status === "ASSIGNED" || status === "ATTENDED";
}

export interface EffectivenessDueCheck {
  status: LearningAssignmentStatus;
  effectivenessRequiredSnapshot: boolean;
  effectivenessCompletedAt: Date | null;
}

// TRN-04/TRN-15: only a completed assignment whose course required
// effectiveness (snapshotted at assignment time, TRN-04) and that hasn't
// already been evaluated is due for the D+30 supervisor follow-up.
export function isEffectivenessDue(assignment: EffectivenessDueCheck): boolean {
  return (
    assignment.status === "COMPLETED" &&
    assignment.effectivenessRequiredSnapshot &&
    assignment.effectivenessCompletedAt === null
  );
}

import { describe, it, expect } from "vitest";
import {
  formatTrainingRequestNumber,
  canDeptHeadDecideTrainingRequest,
  canTrainingAdminValidateTrainingRequest,
  canTrainingAdminScheduleTrainingRequest,
  canCancelTrainingRequest,
  isTerminalTrainingRequestStatus,
  DEFAULT_EFFECTIVENESS_FOLLOWUP_DAYS,
  computeEffectivenessDueDate,
  canConfirmLearningAssignmentAttendance,
  canCompleteLearningAssignment,
  canCancelLearningAssignment,
  isEffectivenessDue,
} from "./training";

describe("formatTrainingRequestNumber", () => {
  it("formats like TRN-YYYY-NNNN", () => {
    expect(formatTrainingRequestNumber(7, 2026)).toBe("TRN-2026-0007");
  });
});

describe("TrainingRequest lifecycle (TRN-02/TRN-10)", () => {
  it("only SUBMITTED can be decided by the Department Head", () => {
    expect(canDeptHeadDecideTrainingRequest("SUBMITTED")).toBe(true);
    expect(canDeptHeadDecideTrainingRequest("DEPT_HEAD_APPROVED")).toBe(false);
  });

  it("only DEPT_HEAD_APPROVED can be validated by Training Admin", () => {
    expect(canTrainingAdminValidateTrainingRequest("DEPT_HEAD_APPROVED")).toBe(true);
    expect(canTrainingAdminValidateTrainingRequest("SUBMITTED")).toBe(false);
  });

  it("only VALIDATED can be scheduled by Training Admin", () => {
    expect(canTrainingAdminScheduleTrainingRequest("VALIDATED")).toBe(true);
    expect(canTrainingAdminScheduleTrainingRequest("DEPT_HEAD_APPROVED")).toBe(false);
  });

  it("SUBMITTED/DEPT_HEAD_APPROVED/VALIDATED are cancellable, terminal states are not", () => {
    expect(canCancelTrainingRequest("SUBMITTED")).toBe(true);
    expect(canCancelTrainingRequest("DEPT_HEAD_APPROVED")).toBe(true);
    expect(canCancelTrainingRequest("VALIDATED")).toBe(true);
    expect(canCancelTrainingRequest("REJECTED")).toBe(false);
    expect(canCancelTrainingRequest("SCHEDULED")).toBe(false);
    expect(canCancelTrainingRequest("CANCELLED")).toBe(false);
  });

  it("REJECTED/SCHEDULED/CANCELLED are terminal", () => {
    expect(isTerminalTrainingRequestStatus("REJECTED")).toBe(true);
    expect(isTerminalTrainingRequestStatus("SCHEDULED")).toBe(true);
    expect(isTerminalTrainingRequestStatus("CANCELLED")).toBe(true);
    expect(isTerminalTrainingRequestStatus("VALIDATED")).toBe(false);
  });
});

describe("computeEffectivenessDueDate (TRN-04)", () => {
  it("defaults to D+30", () => {
    const completedAt = new Date("2026-01-01T00:00:00.000Z");
    const due = computeEffectivenessDueDate(completedAt, DEFAULT_EFFECTIVENESS_FOLLOWUP_DAYS);
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("honors a configured interval", () => {
    const completedAt = new Date("2026-01-01T00:00:00.000Z");
    const due = computeEffectivenessDueDate(completedAt, 14);
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-15");
  });
});

describe("LearningAssignment lifecycle", () => {
  it("attendance can only be confirmed from ASSIGNED", () => {
    expect(canConfirmLearningAssignmentAttendance("ASSIGNED")).toBe(true);
    expect(canConfirmLearningAssignmentAttendance("ATTENDED")).toBe(false);
  });

  it("completion requires ATTENDED first", () => {
    expect(canCompleteLearningAssignment("ATTENDED")).toBe(true);
    expect(canCompleteLearningAssignment("ASSIGNED")).toBe(false);
  });

  it("ASSIGNED/ATTENDED are cancellable, COMPLETED/CANCELLED are not", () => {
    expect(canCancelLearningAssignment("ASSIGNED")).toBe(true);
    expect(canCancelLearningAssignment("ATTENDED")).toBe(true);
    expect(canCancelLearningAssignment("COMPLETED")).toBe(false);
    expect(canCancelLearningAssignment("CANCELLED")).toBe(false);
  });
});

describe("isEffectivenessDue (TRN-04/TRN-15)", () => {
  it("true only for a completed, effectiveness-required, not-yet-evaluated assignment", () => {
    expect(isEffectivenessDue({ status: "COMPLETED", effectivenessRequiredSnapshot: true, effectivenessCompletedAt: null })).toBe(
      true,
    );
  });

  it("false when effectiveness isn't required", () => {
    expect(
      isEffectivenessDue({ status: "COMPLETED", effectivenessRequiredSnapshot: false, effectivenessCompletedAt: null }),
    ).toBe(false);
  });

  it("false when not yet completed", () => {
    expect(isEffectivenessDue({ status: "ATTENDED", effectivenessRequiredSnapshot: true, effectivenessCompletedAt: null })).toBe(
      false,
    );
  });

  it("false when already evaluated", () => {
    expect(
      isEffectivenessDue({ status: "COMPLETED", effectivenessRequiredSnapshot: true, effectivenessCompletedAt: new Date() }),
    ).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  formatMovementRequestNumber,
  canDecideMovementRequestStatus,
  canExecuteMovementRequestStatus,
  canCancelMovementRequestStatus,
  requiresProposedEmploymentStatus,
  validateProposedPosition,
  isPerubahanPosisiType,
  compareJobLevels,
  validateJobLevelDirection,
  isMovementRequestOpen,
  isAddPositionType,
  requiresVacantProposedPosition,
  initialMovementStatus,
  isMovementSubmitLevel,
} from "./movement";
import { movementNeedsEvaluation } from "./evaluation";

describe("formatMovementRequestNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(formatMovementRequestNumber(1, 2026)).toBe("MOV-2026-0001");
    expect(formatMovementRequestNumber(42, 2026)).toBe("MOV-2026-0042");
  });
});

describe("canDecideMovementRequestStatus (LIF-04)", () => {
  it("only allows deciding a Submitted request", () => {
    expect(canDecideMovementRequestStatus("SUBMITTED")).toBe(true);
    expect(canDecideMovementRequestStatus("APPROVED")).toBe(false);
    expect(canDecideMovementRequestStatus("REJECTED")).toBe(false);
    expect(canDecideMovementRequestStatus("IMPLEMENTED")).toBe(false);
    expect(canDecideMovementRequestStatus("CANCELLED")).toBe(false);
  });
});

describe("canExecuteMovementRequestStatus (LIF-04)", () => {
  it("only allows executing an Approved request", () => {
    expect(canExecuteMovementRequestStatus("APPROVED")).toBe(true);
    expect(canExecuteMovementRequestStatus("SUBMITTED")).toBe(false);
    expect(canExecuteMovementRequestStatus("REJECTED")).toBe(false);
    expect(canExecuteMovementRequestStatus("IMPLEMENTED")).toBe(false);
    expect(canExecuteMovementRequestStatus("CANCELLED")).toBe(false);
  });
});

describe("canCancelMovementRequestStatus", () => {
  it("blocks Implemented, Cancelled, and Rejected", () => {
    expect(canCancelMovementRequestStatus("IMPLEMENTED")).toBe(false);
    expect(canCancelMovementRequestStatus("CANCELLED")).toBe(false);
    expect(canCancelMovementRequestStatus("REJECTED")).toBe(false);
  });

  it("allows Submitted and Approved", () => {
    expect(canCancelMovementRequestStatus("SUBMITTED")).toBe(true);
    expect(canCancelMovementRequestStatus("APPROVED")).toBe(true);
  });
});

describe("requiresProposedEmploymentStatus", () => {
  it("is true only for STATUS_CHANGE", () => {
    expect(requiresProposedEmploymentStatus("STATUS_CHANGE")).toBe(true);
    expect(requiresProposedEmploymentStatus("PROMOTION")).toBe(false);
    expect(requiresProposedEmploymentStatus("ROTATION")).toBe(false);
    expect(requiresProposedEmploymentStatus("MUTATION")).toBe(false);
    expect(requiresProposedEmploymentStatus("DEMOTION")).toBe(false);
  });
});

describe("validateProposedPosition", () => {
  it("requires STATUS_CHANGE to keep the same Position", () => {
    expect(validateProposedPosition("STATUS_CHANGE", "pos-1", "pos-1")).toBeNull();
    expect(validateProposedPosition("STATUS_CHANGE", "pos-1", "pos-2")).not.toBeNull();
  });

  it("requires every other type to propose a different Position", () => {
    expect(validateProposedPosition("PROMOTION", "pos-1", "pos-2")).toBeNull();
    expect(validateProposedPosition("PROMOTION", "pos-1", "pos-1")).not.toBeNull();
    expect(validateProposedPosition("ROTATION", "pos-1", "pos-1")).not.toBeNull();
    expect(validateProposedPosition("MUTATION", "pos-1", "pos-1")).not.toBeNull();
    expect(validateProposedPosition("DEMOTION", "pos-1", "pos-1")).not.toBeNull();
  });
});

describe("isPerubahanPosisiType (Perubahan Posisi refactor)", () => {
  it("allows Promosi, Mutasi, Demosi and Tambah Posisi", () => {
    expect(isPerubahanPosisiType("ADD_POSITION")).toBe(true);
    expect(isPerubahanPosisiType("PROMOTION")).toBe(true);
    expect(isPerubahanPosisiType("MUTATION")).toBe(true);
    expect(isPerubahanPosisiType("DEMOTION")).toBe(true);
  });

  it("excludes the legacy Rotasi and Perubahan Status types", () => {
    expect(isPerubahanPosisiType("ROTATION")).toBe(false);
    expect(isPerubahanPosisiType("STATUS_CHANGE")).toBe(false);
  });
});

describe("who may file a Perubahan Posisi: job level 2C and above", () => {
  it("allows 2C, 3A, 3B, 4A and 5A", () => {
    for (const level of ["2C", "3A", "3B", "4A", "5A"]) expect(isMovementSubmitLevel(level)).toBe(true);
  });
  it("does not allow the levels below 2C", () => {
    for (const level of ["1A", "1B", "1C", "2A", "2B"]) expect(isMovementSubmitLevel(level)).toBe(false);
  });
  it("does not guess when the level code cannot be read", () => {
    expect(isMovementSubmitLevel("")).toBe(false);
    expect(isMovementSubmitLevel("Manager")).toBe(false);
  });
});

describe("Tambah Posisi", () => {
  it("is its own type", () => {
    expect(isAddPositionType("ADD_POSITION")).toBe(true);
    expect(isAddPositionType("MUTATION")).toBe(false);
  });

  it("does not need the proposed position to be free of a primary holder, a move does", () => {
    expect(requiresVacantProposedPosition("ADD_POSITION")).toBe(false);
    expect(requiresVacantProposedPosition("STATUS_CHANGE")).toBe(false);
    expect(requiresVacantProposedPosition("MUTATION")).toBe(true);
    expect(requiresVacantProposedPosition("PROMOTION")).toBe(true);
  });

  it("must still name a position other than the current one, in any department", () => {
    expect(validateProposedPosition("ADD_POSITION", "pos-a", "pos-a")).not.toBeNull();
    expect(validateProposedPosition("ADD_POSITION", "pos-a", "pos-b")).toBeNull();
  });

  it("goes straight to the HR Manager, every other type starts with the Department Head", () => {
    expect(initialMovementStatus("ADD_POSITION")).toBe("SUBMITTED");
    expect(initialMovementStatus("MUTATION")).toBe("PENDING_DEPT_HEAD");
    expect(initialMovementStatus("PROMOTION")).toBe("PENDING_DEPT_HEAD");
    expect(initialMovementStatus("DEMOTION")).toBe("PENDING_DEPT_HEAD");
  });

  it("needs no evaluation, like a Mutasi, and has no level direction rule", () => {
    expect(movementNeedsEvaluation("ADD_POSITION", "MUTASI")).toBe(false);
    expect(validateJobLevelDirection("ADD_POSITION", "3B", "2A")).toBeNull();
    expect(validateJobLevelDirection("ADD_POSITION", "2A", "3B")).toBeNull();
  });
});

describe("compareJobLevels", () => {
  it("compares numeric tier first", () => {
    expect(compareJobLevels("4", "3B")).toBeGreaterThan(0);
    expect(compareJobLevels("2A", "3A")).toBeLessThan(0);
  });

  it("compares the letter sub-tier within the same numeric tier", () => {
    expect(compareJobLevels("1C", "1B")).toBeGreaterThan(0);
    expect(compareJobLevels("3A", "3B")).toBeLessThan(0);
    expect(compareJobLevels("3B", "3B")).toBe(0);
  });

  it("returns null for a code that doesn't parse", () => {
    expect(compareJobLevels("Senior", "3B")).toBeNull();
  });
});

describe("validateJobLevelDirection", () => {
  it("requires Promosi to move to a strictly higher level", () => {
    expect(validateJobLevelDirection("PROMOTION", "3A", "3B")).toBeNull();
    expect(validateJobLevelDirection("PROMOTION", "3B", "3A")).not.toBeNull();
    expect(validateJobLevelDirection("PROMOTION", "3B", "3B")).not.toBeNull();
  });

  it("requires Demotasi to move to a strictly lower level", () => {
    expect(validateJobLevelDirection("DEMOTION", "3B", "3A")).toBeNull();
    expect(validateJobLevelDirection("DEMOTION", "3A", "3B")).not.toBeNull();
  });

  it("does not constrain Mutasi by level direction", () => {
    expect(validateJobLevelDirection("MUTATION", "3B", "3B")).toBeNull();
    expect(validateJobLevelDirection("MUTATION", "3A", "4")).toBeNull();
  });

  it("skips validation when a level code can't be parsed", () => {
    expect(validateJobLevelDirection("PROMOTION", "Senior", "3B")).toBeNull();
  });
});

describe("isMovementRequestOpen (one open request per employee)", () => {
  it("counts the three in-flight statuses as open", () => {
    for (const s of ["PENDING_DEPT_HEAD", "SUBMITTED", "APPROVED"] as const) expect(isMovementRequestOpen(s)).toBe(true);
  });
  it("counts finished and returned requests as closed", () => {
    for (const s of ["IMPLEMENTED", "CANCELLED", "REJECTED", "RETURNED"] as const) expect(isMovementRequestOpen(s)).toBe(false);
  });
});

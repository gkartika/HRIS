// Pure business logic for the Movement Request flow (LIF-04, Data Fields
// Blueprint "28 Movement Requests"). No Prisma/Next imports — unit testable
// with plain values, same pattern as recruitment.ts.
import type { MovementRequestStatus, MovementType } from "@/generated/prisma/enums";

export function formatMovementRequestNumber(sequence: number, year: number): string {
  return `MOV-${year}-${String(sequence).padStart(4, "0")}`;
}

// LIF-04: "HR Manager approves or rejects" — only a freshly Submitted
// request is awaiting that decision.
export function canDecideMovementRequestStatus(status: MovementRequestStatus): boolean {
  return status === "SUBMITTED";
}

// LIF-04: "HR Admin executes" — only after HR Manager has Approved.
export function canExecuteMovementRequestStatus(status: MovementRequestStatus): boolean {
  return status === "APPROVED";
}

// An employee may have only ONE open Perubahan Posisi request at a time
// (decided 2026-10-08): two open requests for the same person could be
// approved side by side, and the second would then fail at execution. A
// returned request counts as closed here; it can only be cancelled.
export const OPEN_MOVEMENT_STATUSES: MovementRequestStatus[] = ["PENDING_DEPT_HEAD", "SUBMITTED", "APPROVED"];

export function isMovementRequestOpen(status: MovementRequestStatus): boolean {
  return OPEN_MOVEMENT_STATUSES.includes(status);
}

// Blueprint's approval_status has no "Returned" state; cancellation is only
// meaningful before execution.
const NOT_CANCELLABLE_STATUSES: MovementRequestStatus[] = ["IMPLEMENTED", "CANCELLED", "REJECTED"];

export function canCancelMovementRequestStatus(status: MovementRequestStatus): boolean {
  return !NOT_CANCELLABLE_STATUSES.includes(status);
}

// Only the STATUS_CHANGE type (employment status conversion, e.g. PKWT ->
// PKWTT) carries a proposedEmploymentStatus — every other type is a pure
// Position change.
export function requiresProposedEmploymentStatus(movementType: MovementType): boolean {
  return movementType === "STATUS_CHANGE";
}

/**
 * STATUS_CHANGE never changes Position (proposedPositionId must equal
 * currentPositionId); every other movementType must actually propose a
 * different Position — otherwise there's nothing to move.
 */
export function validateProposedPosition(
  movementType: MovementType,
  currentPositionId: string,
  proposedPositionId: string
): string | null {
  const samePosition = currentPositionId === proposedPositionId;
  if (movementType === "STATUS_CHANGE") {
    return samePosition ? null : "Perubahan Status tidak mengubah Posisi — pilih Posisi yang sama dengan saat ini.";
  }
  return samePosition ? "Posisi yang diusulkan harus berbeda dari Posisi saat ini." : null;
}

// ---------- Perubahan Posisi refactor (2026-08-03) ----------
// Only these three types are offered by the Perubahan Posisi submit form
// going forward — ROTATION and STATUS_CHANGE remain valid historical
// movementType values (existing rows are never touched/deleted) but are no
// longer creatable, and render read-only/archived in the UI.
export const PERUBAHAN_POSISI_TYPES: MovementType[] = ["PROMOTION", "MUTATION", "DEMOTION"];

export function isPerubahanPosisiType(movementType: MovementType): boolean {
  return PERUBAHAN_POSISI_TYPES.includes(movementType);
}

/**
 * Parses a Job.jobLevel code into a comparable (tier, subTier) pair —
 * e.g. "3B" -> [3, "B"], "12" -> [12, ""]. Job.jobLevel is a free-text
 * field with no dedicated ordinal column, but every level code observed in
 * this org (both seed data and the real FR-HC-01-09 examples: 1B, 1C, 2A,
 * 3A, 3B, 4, 5) follows this numeric-tier-plus-optional-letter-subtier
 * shape, so it's used as the comparison key rather than adding a new field
 * speculatively. Returns null for a code that doesn't fit — direction
 * validation is then skipped rather than guessed.
 */
function parseJobLevel(jobLevel: string): [number, string] | null {
  const match = /^(\d+)([A-Za-z]*)$/.exec(jobLevel.trim());
  if (!match) return null;
  return [Number(match[1]), match[2].toUpperCase()];
}

/**
 * Positive if `a` is a higher tier than `b`, negative if lower, 0 if equal,
 * null if either code doesn't parse (direction can't be determined).
 */
export function compareJobLevels(a: string, b: string): number | null {
  const parsedA = parseJobLevel(a);
  const parsedB = parseJobLevel(b);
  if (!parsedA || !parsedB) return null;
  if (parsedA[0] !== parsedB[0]) return parsedA[0] - parsedB[0];
  if (parsedA[1] === parsedB[1]) return 0;
  return parsedA[1] > parsedB[1] ? 1 : -1;
}

/**
 * Promosi must move to a strictly higher job level; Demotasi to a strictly
 * lower one. Mutasi "normally remains at the equivalent level" — a norm,
 * not a hard rule, so it isn't validated here (only that the Position
 * itself differs, already enforced by validateProposedPosition). Returns
 * null (no error) when the levels can't be parsed/compared — this only
 * blocks a clearly wrong-direction submission, it never blocks on
 * ambiguous data.
 */
export function validateJobLevelDirection(
  movementType: MovementType,
  currentJobLevel: string,
  proposedJobLevel: string
): string | null {
  const comparison = compareJobLevels(proposedJobLevel, currentJobLevel);
  if (comparison === null) return null;
  if (movementType === "PROMOTION" && comparison <= 0) {
    return "Promosi harus menuju Golongan/Jabatan yang lebih tinggi dari saat ini.";
  }
  if (movementType === "DEMOTION" && comparison >= 0) {
    return "Demosi harus menuju Golongan/Jabatan yang lebih rendah dari saat ini.";
  }
  return null;
}

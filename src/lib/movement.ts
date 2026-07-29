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

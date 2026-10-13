// Pure business logic for Phase 4A Employee Assets. No Prisma/Next
// imports — unit testable, same pattern as lms.ts/onboarding.ts.

// LOST_PENDING_REVIEW/RETIRED added for Phase 4B (GA Operations) — see
// ga-operations.ts. isAssetAvailableForIndividualAssignment below already
// blocks assignment for both with no further change needed here.
export type AssetStatusValue =
  | "AVAILABLE"
  | "IN_USE"
  | "UNDER_REPAIR"
  | "DISPOSED"
  | "LOST_PENDING_REVIEW"
  | "RETIRED";
export type AssetCustodyStatusValue = "ACTIVE" | "RETURNED";
export type AssetCustodyTargetTypeValue = "EMPLOYEE" | "DEPARTMENT" | "LOCATION";
export type AssetInspectionResultValue = "GOOD" | "NEEDS_REPAIR" | "LOST_OR_BEYOND_REPAIR";

// Core control: "One active individual asset cannot have two active custody
// records." A custody row is "open" (blocks a new one on the same
// INDIVIDUAL asset) whenever it hasn't been returned yet.
export function isCustodyOpen(status: AssetCustodyStatusValue): boolean {
  return status !== "RETURNED";
}

export function isAssetAvailableForIndividualAssignment(status: AssetStatusValue): boolean {
  return status === "AVAILABLE";
}

export function canAllocateQuantity(availableQuantity: number, requestedQuantity: number): boolean {
  return requestedQuantity > 0 && requestedQuantity <= availableQuantity;
}

// PDF "Return outcome and controls": Good condition -> Available; Needs
// repair -> Phase 4B repair (out of scope here, just record the state);
// Lost or beyond repair -> Phase 4B disposal (same).
export function computeAssetStatusAfterReturn(inspectionResult: AssetInspectionResultValue): AssetStatusValue {
  if (inspectionResult === "GOOD") return "AVAILABLE";
  if (inspectionResult === "NEEDS_REPAIR") return "UNDER_REPAIR";
  return "DISPOSED";
}

// A quantity-tracked return only rejoins the usable pool when it comes back
// in GOOD condition — a damaged/lost quantity permanently reduces what's
// available until a future Phase 4B repair/disposal workflow exists.
export function computeAvailableQuantityAfterReturn(
  currentAvailableQuantity: number,
  returnedQuantity: number,
  inspectionResult: AssetInspectionResultValue
): number {
  if (inspectionResult !== "GOOD") return currentAvailableQuantity;
  return currentAvailableQuantity + returnedQuantity;
}

// Where an asset may be placed: only to an employee or to a department. Placing
// straight to a location is no longer allowed (old LOCATION records stay readable),
// and a department placement must say which location the asset is at.
export function validatePlacement(targetType: AssetCustodyTargetTypeValue, locationId: string | null | undefined): string | null {
  if (targetType === "LOCATION") return "Penempatan langsung ke lokasi tidak diperbolehkan. Pilih karyawan atau departemen.";
  if (targetType === "DEPARTMENT" && !locationId) return "Lokasi wajib dipilih untuk penempatan ke departemen.";
  return null;
}

// Core control: "Only open Employee custody blocks offboarding;
// Department/Location custody does not."
export function blocksOffboarding(targetType: AssetCustodyTargetTypeValue, status: AssetCustodyStatusValue): boolean {
  return targetType === "EMPLOYEE" && isCustodyOpen(status);
}

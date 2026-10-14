// Pure business logic for Offboarding (LIF-06/07/12, WF-10, GA-05,
// DSH-08/09/14). No Prisma/Next imports — unit testable with plain values,
// same pattern as contract-renewal.ts/evaluation.ts/movement.ts.
import type { OffboardingCaseStatus, AssetInspectionResult, DisposalReason } from "@/generated/prisma/enums";
import { computeAssetStatusAfterReturn, type AssetStatusValue } from "@/lib/assets";

export function formatOffboardingCaseNumber(sequence: number, year: number): string {
  return `OFB-${year}-${String(sequence).padStart(4, "0")}`;
}

// HR Admin alone opens an offboarding case (per direct user request) — there
// is no Dept Head / HR Manager approval stage, so every case starts here.
export const INITIAL_OFFBOARDING_CASE_STATUS: OffboardingCaseStatus = "PENDING_CLEARANCE";

export function canExecuteExitClearanceStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_CLEARANCE";
}

export function canCancelOffboardingCaseStatus(status: OffboardingCaseStatus): boolean {
  return status === "PENDING_CLEARANCE";
}

// Company form number printed on the Exit Clearance form (employee questions
// and the HR closing step are one document). Shown with the same wording the
// other forms use, e.g. "Evaluasi Kinerja (FR-HC-01-07)".
export const EXIT_CLEARANCE_FORM_NUMBER = "FR-HC-01-11";

// The employee stays active, with their login, through the whole last working
// day (decided 2026-10-08). Only once the company-local date is AFTER that day
// is the person deactivated. Both dates are date-only values at UTC midnight.
export function isPastLastWorkingDay(lastWorkingDay: Date, today: Date): boolean {
  return today.getTime() > lastWorkingDay.getTime();
}

// Condition an asset comes back in at Exit Clearance. "Hilang" and "Rusak
// berat" both end in a disposal proposal that needs approval, exactly like the
// GA loss and maintenance paths, instead of marking the asset disposed on the
// spot (decided 2026-10-08). The old combined value is read as "Rusak berat".
export type ExitReturnCondition = "GOOD" | "NEEDS_REPAIR" | "BEYOND_REPAIR" | "LOST";

export interface ExitReturnOutcome {
  condition: ExitReturnCondition;
  inspectionResult: AssetInspectionResult;
  /** Set when a disposal case must be drafted for this asset. */
  disposalReason: DisposalReason | null;
  /** Status of an individually tracked asset after the return. */
  assetStatus: AssetStatusValue;
}

export function parseExitReturnCondition(raw: string | null | undefined): ExitReturnOutcome | null {
  switch (raw) {
    case "GOOD":
      return { condition: "GOOD", inspectionResult: "GOOD", disposalReason: null, assetStatus: computeAssetStatusAfterReturn("GOOD") };
    case "NEEDS_REPAIR":
      return {
        condition: "NEEDS_REPAIR",
        inspectionResult: "NEEDS_REPAIR",
        disposalReason: null,
        assetStatus: computeAssetStatusAfterReturn("NEEDS_REPAIR"),
      };
    case "LOST":
      return {
        condition: "LOST",
        inspectionResult: "LOST_OR_BEYOND_REPAIR",
        disposalReason: "CONFIRMED_LOSS",
        assetStatus: "PENDING_DISPOSAL",
      };
    case "BEYOND_REPAIR":
    case "LOST_OR_BEYOND_REPAIR":
      return {
        condition: "BEYOND_REPAIR",
        inspectionResult: "LOST_OR_BEYOND_REPAIR",
        disposalReason: "BEYOND_REPAIR",
        assetStatus: "PENDING_DISPOSAL",
      };
    default:
      return null;
  }
}

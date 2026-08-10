// Pure business logic for Phase 2 Extension: Absence (Cuti/Izin/Sakit/
// Lainnya). No Prisma/Next imports — unit testable with plain values, same
// pattern as offboarding.ts/contract-renewal.ts.
import type { AbsenceStatus } from "@/generated/prisma/enums";

export function formatAbsenceRequestNumber(sequence: number, year: number): string {
  return `ABS-${year}-${String(sequence).padStart(4, "0")}`;
}

// Inclusive date-range overlap check — two Absence requests for the same
// employee must not cover any of the same day.
export function doDateRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

// Inclusive day count — e.g. Monday to Wednesday is 3 days, not 2.
export function absenceDayCount(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.round((end - start) / msPerDay) + 1;
}

// Two-stage chain: configured first-approver Position, then HR Admin — no
// HR Manager stage anywhere in this flow, per direct spec.
export function canDecideAbsenceRequestAsFirstApproverStatus(status: AbsenceStatus): boolean {
  return status === "SUBMITTED";
}

export function canDecideAbsenceRequestAsHrAdminStatus(status: AbsenceStatus): boolean {
  return status === "PENDING_HR_ADMIN";
}

export function canCancelAbsenceRequestStatus(status: AbsenceStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_HR_ADMIN";
}

// HR Admin override: an already-decided request (APPROVED/REJECTED) can be
// corrected in place — never a fresh SUBMITTED/PENDING_HR_ADMIN request,
// which should simply go through the normal decision flow instead.
export function canHrOverrideAbsenceRequestStatus(status: AbsenceStatus): boolean {
  return status === "APPROVED" || status === "REJECTED";
}

export function remainingEntitlementDays(annualDays: number, usedDays: number): number {
  return Math.max(0, annualDays - usedDays);
}

// Pure business logic for Phase 2 Extension: Absence (Cuti/Izin/Sakit/
// Lainnya). No Prisma/Next imports — unit testable with plain values, same
// pattern as offboarding.ts/contract-renewal.ts.
import { DAY_MS } from "@/lib/company-time";
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
  const start = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  return Math.round((end - start) / DAY_MS) + 1;
}

// Days of a leave request that are real working days for this employee
// (decided 2026-10-08): weekends, days off in their shift, and public holidays
// (Tanggal Merah and Cuti Bersama) do not use up leave. `isScheduled` is the
// same "is this person scheduled to work that day" rule the attendance
// reconciliation uses (buildIsScheduledToWorkLookup in shift-assignment.ts).
export function scheduledDaysInRange(
  isScheduled: (employeeId: string, day: Date) => boolean,
  employeeId: string,
  startDate: Date,
  endDate: Date
): Date[] {
  const start = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const days: Date[] = [];
  for (let time = start; time <= end; time += DAY_MS) {
    const day = new Date(time);
    if (isScheduled(employeeId, day)) days.push(day);
  }
  return days;
}

// Chain: configured first-approver Position, optionally a second (only for
// requesters whose Section AND Department both have their own
// AbsenceApproverConfig row), then HR Admin — no HR Manager stage anywhere
// in this flow, per direct spec.
export function canDecideAbsenceRequestAsFirstApproverStatus(status: AbsenceStatus): boolean {
  return status === "SUBMITTED";
}

export function canDecideAbsenceRequestAsSecondApproverStatus(status: AbsenceStatus): boolean {
  return status === "PENDING_SECOND_APPROVER";
}

export function canDecideAbsenceRequestAsHrAdminStatus(status: AbsenceStatus): boolean {
  return status === "PENDING_HR_ADMIN";
}

export function canCancelAbsenceRequestStatus(status: AbsenceStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_SECOND_APPROVER" || status === "PENDING_HR_ADMIN";
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

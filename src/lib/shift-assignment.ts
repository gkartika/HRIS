// Pure business logic for Shift Assignment (new, per direct user request:
// "assign shift or non shift for each employee... changes weekly, submitted
// by level 3"). No Prisma/Next imports — unit testable with plain values,
// same pattern as offboarding.ts/movement.ts.
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

// Per direct user request: adding every employee explicitly every week was
// the friction — most weeks, most people are simply Shift 1. A missing
// ShiftAssignment row for a given employee/week is now read as this value
// everywhere (UI display, exports, etc.), not "unknown" — only deviations
// from it need an actual row.
export const DEFAULT_SHIFT_TYPE: ShiftAssignmentType = "SHIFT_1";

// One row per employee per calendar week (Monday-start), regardless of
// which day within that week the submitter picks — half-open like every
// other effective-dating convention in this app (org-chart.ts,
// hr-manager.ts), just at week granularity instead of a range.
export function normalizeWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

// The "scheduled minutes for a shift/day-of-week" and "which shift is this
// employee assigned for this week" lookups were being rebuilt from scratch
// (same two Map constructions, copy-pasted) in every reconciliation/report
// query that needs them — attendance-reconciliation-queue.ts's
// getUnresolvedDays/getReconciliationGrid and mandays-lost.ts. Centralized
// here since they're this module's own domain (WorkScheduleConfig/
// ShiftAssignment), taking already-fetched rows rather than querying
// themselves, so callers keep control over batching/filtering their own
// Prisma calls.

export function buildScheduleMinutesLookup(
  rows: { shiftType: ShiftAssignmentType; dayOfWeek: number; minutes: number }[]
): (shiftType: string, dayOfWeek: number) => number {
  const byKey = new Map(rows.map((r) => [`${r.shiftType}:${r.dayOfWeek}`, r.minutes]));
  return (shiftType, dayOfWeek) => byKey.get(`${shiftType}:${dayOfWeek}`) ?? 0;
}

export function buildAssignedShiftLookup(
  rows: { employeeId: string; weekStartDate: Date; shiftType: ShiftAssignmentType }[]
): (employeeId: string, weekStart: Date) => ShiftAssignmentType {
  const byKey = new Map(rows.map((r) => [`${r.employeeId}:${r.weekStartDate.getTime()}`, r.shiftType]));
  return (employeeId, weekStart) => byKey.get(`${employeeId}:${weekStart.getTime()}`) ?? DEFAULT_SHIFT_TYPE;
}

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// DM-07 "one occupant per seat": a Position must never have two different
// Employees holding an active Primary Assignment at the same time. Shared by
// the Movement action and the Recruitment Request fulfillment flow, since
// both create a new Primary Assignment on an existing Position.
//
// Exception (owner, 2026-10-28): a holder who is leaving (exit case waiting for clearance) does not
// block the seat, so the replacement can start in the same position a few days before the leaver's last day.
export const STAYING_HOLDER: Prisma.EmployeeWhereInput = { offboardingCases: { none: { status: "PENDING_CLEARANCE" } } };

export async function isPositionOccupiedByPrimary(
  positionId: string,
  excludingEmployeeId?: string
): Promise<boolean> {
  const existing = await prisma.assignment.findFirst({
    where: {
      positionId,
      assignmentType: "PRIMARY",
      // A scheduled move into the seat reserves it, so nobody else can be put there first.
      status: { in: ["ACTIVE", "SCHEDULED"] },
      ...(excludingEmployeeId ? { employeeId: { not: excludingEmployeeId } } : {}),
      employee: STAYING_HOLDER,
    },
  });
  return !!existing;
}

/** For each of these seats, the leaving holder (if any): who and their last working day, for the seat pickers. */
export async function leavingHoldersOf(positionIds: string[]): Promise<Map<string, { name: string; lastWorkingDay: Date }>> {
  const result = new Map<string, { name: string; lastWorkingDay: Date }>();
  if (positionIds.length === 0) return result;
  const rows = await prisma.assignment.findMany({
    where: {
      positionId: { in: positionIds },
      assignmentType: "PRIMARY",
      status: { in: ["ACTIVE", "SCHEDULED"] },
      employee: { offboardingCases: { some: { status: "PENDING_CLEARANCE" } } },
    },
    select: { positionId: true, employee: { select: { fullLegalName: true, offboardingCases: { where: { status: "PENDING_CLEARANCE" }, select: { lastWorkingDay: true } } } } },
  });
  for (const r of rows) {
    const day = r.employee.offboardingCases[0]?.lastWorkingDay;
    if (day) result.set(r.positionId, { name: r.employee.fullLegalName, lastWorkingDay: day });
  }
  return result;
}

// Keep a position's stored status (Kosong/Terisi) in sync with whether it
// has an active Assignment right now. Status is never set by hand any more
// (2026-10-08), so any leftover PLANNED/FROZEN/CLOSED value is overwritten
// too. The org chart itself always computes live occupancy from Assignment
// rows; this is so the admin list and its filter are not stale.
export async function syncPositionStatus(positionId: string): Promise<void> {
  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return;
  const activeCount = await prisma.assignment.count({
    where: { positionId, status: "ACTIVE" },
  });
  await prisma.position.update({
    where: { id: positionId },
    data: { positionStatus: activeCount > 0 ? "FILLED" : "VACANT" },
  });
}

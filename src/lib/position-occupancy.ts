import { prisma } from "@/lib/db";

// DM-07 "one occupant per seat": a Position must never have two different
// Employees holding an active Primary Assignment at the same time. Shared by
// the Movement action and the Recruitment Request fulfillment flow, since
// both create a new Primary Assignment on an existing Position.
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
    },
  });
  return !!existing;
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

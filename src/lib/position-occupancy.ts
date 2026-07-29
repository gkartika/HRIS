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
      status: "ACTIVE",
      ...(excludingEmployeeId ? { employeeId: { not: excludingEmployeeId } } : {}),
    },
  });
  return !!existing;
}

// If a position's stored status is just VACANT/FILLED (not an admin-set
// PLANNED/FROZEN/CLOSED override), keep it in sync with whether it actually
// has an active Assignment right now. The org chart itself always computes
// live occupancy from Assignment rows — this is only so the plain admin list
// view (src/app/(app)/admin/positions) shows a status that isn't obviously stale.
export async function syncPositionStatus(positionId: string): Promise<void> {
  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position || (position.positionStatus !== "VACANT" && position.positionStatus !== "FILLED")) {
    return;
  }
  const activeCount = await prisma.assignment.count({
    where: { positionId, status: "ACTIVE" },
  });
  await prisma.position.update({
    where: { id: positionId },
    data: { positionStatus: activeCount > 0 ? "FILLED" : "VACANT" },
  });
}

import { prisma } from "@/lib/db";

// LIF-04: "An authorized manager submits or recommends" a Movement Request
// for their own direct report — not just anyone with an EMPLOYEE_LOGIN
// account. Split into its own Prisma-backed file for the same reason as
// hr-manager.ts: keeps permissions.ts's predicates pure/dependency-free.
export async function isDirectManagerOfEmployee(
  managerEmployeeId: string | null | undefined,
  targetEmployeeId: string
): Promise<boolean> {
  if (!managerEmployeeId) return false;
  if (managerEmployeeId === targetEmployeeId) return false;

  const manager = await prisma.employee.findUnique({
    where: { id: managerEmployeeId },
    select: { currentPositionId: true },
  });
  if (!manager?.currentPositionId) return false;

  const target = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: { currentPositionId: true },
  });
  if (!target?.currentPositionId) return false;

  const targetPosition = await prisma.position.findUnique({
    where: { id: target.currentPositionId },
    select: { reportsToPositionId: true },
  });
  return targetPosition?.reportsToPositionId === manager.currentPositionId;
}

export interface SupervisorCandidate {
  employeeId: string;
  positionId: string;
  assignmentType: string;
}

/**
 * Current holder(s) of the Position that `positionId` reports to (its direct
 * supervisor's seat), via any ACTIVE Assignment covering `asOf`. Empty when
 * the Position has no reportsToPositionId (the org root). Used by Phase 3A's
 * normal-employee P1 routing — "Primary Position supervisor" (COM-15).
 */
export async function getSupervisorCandidatesForPosition(
  positionId: string,
  asOf: Date = new Date()
): Promise<SupervisorCandidate[]> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { reportsToPositionId: true },
  });
  if (!position?.reportsToPositionId) return [];

  return prisma.assignment.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      positionId: position.reportsToPositionId,
    },
    select: { employeeId: true, positionId: true, assignmentType: true },
  });
}

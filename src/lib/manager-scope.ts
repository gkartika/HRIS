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

// Phase 3B "Manager sees employees within their authority" — direct reports
// only (one level), same granularity as isDirectManagerOfEmployee above,
// not a full transitive org-tree walk.
export async function getDirectReportEmployeeIds(managerEmployeeId: string | null | undefined): Promise<string[]> {
  if (!managerEmployeeId) return [];

  const manager = await prisma.employee.findUnique({
    where: { id: managerEmployeeId },
    select: { currentPositionId: true },
  });
  if (!manager?.currentPositionId) return [];

  const reports = await prisma.employee.findMany({
    where: { activeFlag: true, currentPosition: { reportsToPositionId: manager.currentPositionId } },
    select: { id: true },
  });
  return reports.map((r) => r.id);
}

// "Am I anyone's manager at all" — used to gate the "Tim Saya" nav item and
// the Dashboard's simple-vs-full-featured fork. Moved from layout.tsx as-is
// (was a private helper there) so dashboard/page.tsx can reuse the exact
// same check without duplicating it. Deliberately checks for a subordinate
// Position existing at all (even if currently vacant), not
// getDirectReportEmployeeIds' "an active Employee is in it" — a manager
// whose report just resigned shouldn't instantly lose "Tim Saya" visibility.
export async function isManagerOfAnyPosition(employeeId: string | null | undefined): Promise<boolean> {
  if (!employeeId) return false;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee?.currentPositionId) return false;
  const directReport = await prisma.position.findFirst({
    where: { reportsToPositionId: employee.currentPositionId },
  });
  return !!directReport;
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

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

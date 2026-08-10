import { prisma } from "@/lib/db";

// Position.currentHolders is the same denormalized "who holds this seat
// right now" pointer used everywhere else in this app (reportsToPosition
// display, HR Manager authority) — an employee holds at most one current
// Position, so this returns 0 or 1 ids. Shared by the Absence workflow's
// actions and pages so both resolve "who is the current first approver" the
// same way.
export async function getCurrentHolderEmployeeIds(positionId: string | null): Promise<string[]> {
  if (!positionId) return [];
  const holders = await prisma.employee.findMany({
    where: { currentPositionId: positionId, activeFlag: true },
    select: { id: true },
  });
  return holders.map((h) => h.id);
}

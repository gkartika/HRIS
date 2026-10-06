import { cache } from "react";
import { prisma } from "@/lib/db";

// The one lookup behind "which seat does this employee hold right now": a
// single tiny read per request, shared by the manager checks and the pending
// approvals (they each used to read the same employee row again).
export const getEmployeePositionInfo = cache(async (employeeId: string) => {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true, activeFlag: true },
  });
});

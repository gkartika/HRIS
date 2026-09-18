import { prisma } from "@/lib/db";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { DEPT_HEAD_JOB_LEVEL } from "@/lib/dept-head";

/**
 * Resolves the first-approval stage's Position for a new Absence request,
 * per the requester's OWN current Position (not the request's target
 * employee's department alone): a 3B (Department Manager/Head) requester
 * would otherwise BE their own department's configured approver, so their
 * first approval always routes to the Director instead — same fixed,
 * non-configurable escalation already used for Level-3 Competency
 * evaluation routing (COM-15, src/lib/competency-routing.ts). Everyone else
 * keeps the existing per-Department AbsenceApproverConfig behavior.
 */
export async function resolveFirstApproverPositionId(employeeId: string): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee?.currentPositionId) return null;

  const position = await prisma.position.findUnique({
    where: { id: employee.currentPositionId },
    select: { jobLevel: true, orgUnitId: true },
  });
  if (!position) return null;

  if (position.jobLevel === DEPT_HEAD_JOB_LEVEL) {
    const director = await prisma.position.findFirst({
      where: { positionType: "DIRECTOR", reportsToPositionId: null },
      select: { id: true },
    });
    return director?.id ?? null;
  }

  const departmentId = await resolveDepartmentId(position.orgUnitId);
  if (!departmentId) return null;
  const config = await prisma.absenceApproverConfig.findUnique({ where: { departmentId } });
  return config?.approverPositionId ?? null;
}

import { prisma } from "@/lib/db";

// Department Manager/Head approval gate, added ahead of the HR Manager per
// direct user request. Defined literally as "Job level 3B" (not a
// positionType or reporting-line check) — same live-resolved-from-Assignment
// pattern as src/lib/hr-manager.ts, just scoped to a department and a fixed
// job level instead of a grantsHrManagerAccess flag.
const DEPT_HEAD_JOB_LEVEL = "3B";

export interface DeptHeadPosition {
  assignmentId: string;
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

/**
 * Every Position currently granting Department Manager/Head recruitment-
 * approval authority to this Employee within one specific department, via
 * any ACTIVE Assignment whose effective-dated range covers `asOf`.
 */
export async function getActiveDeptHeadPositions(
  employeeId: string | null | undefined,
  departmentId: string,
  asOf: Date = new Date()
): Promise<DeptHeadPosition[]> {
  if (!employeeId) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      employeeId,
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      position: { orgUnitId: departmentId, job: { jobLevel: DEPT_HEAD_JOB_LEVEL } },
    },
    include: { position: { include: { job: true } } },
  });

  return assignments.map((a) => ({
    assignmentId: a.id,
    positionId: a.positionId,
    positionCode: a.position.positionCode,
    jobTitle: a.position.job.jobTitle,
  }));
}

/**
 * Every Employee currently holding level-3B approval authority in one
 * department, company-wide (not scoped to a single Employee) — Perubahan
 * Posisi's self-approval guard: if the requester IS one of these, routing
 * must fall back to a different entry here (e.g. an Acting-type Assignment
 * covering the same Position) rather than silently bypass or self-approve.
 */
export async function getDeptHeadApprovers(
  departmentId: string,
  asOf: Date = new Date()
): Promise<{ employeeId: string; positionId: string }[]> {
  const assignments = await prisma.assignment.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      position: { orgUnitId: departmentId, job: { jobLevel: DEPT_HEAD_JOB_LEVEL } },
    },
    select: { employeeId: true, positionId: true },
  });
  return assignments;
}

/**
 * Every departmentId this Employee currently holds level-3B approval
 * authority in, company-wide — used to populate the personal approvals
 * inbox (no single request's departmentId to scope by yet).
 */
export async function getDeptHeadDepartmentIds(
  employeeId: string | null | undefined,
  asOf: Date = new Date()
): Promise<string[]> {
  if (!employeeId) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      employeeId,
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      position: { job: { jobLevel: DEPT_HEAD_JOB_LEVEL } },
    },
    select: { position: { select: { orgUnitId: true } } },
  });

  return [...new Set(assignments.map((a) => a.position.orgUnitId))];
}

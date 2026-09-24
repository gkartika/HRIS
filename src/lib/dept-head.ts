import { getActiveAssignmentsOf } from "@/lib/active-assignments";

// Department Manager/Head approval gate, added ahead of the HR Manager per
// direct user request. Defined literally as "Job level 3B" (not a
// positionType or reporting-line check) — same live-resolved-from-Assignment
// pattern as src/lib/hr-manager.ts, just scoped to a department and a fixed
// job level instead of a grantsHrManagerAccess flag.
export const DEPT_HEAD_JOB_LEVEL = "3B";

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
  asOf?: Date
): Promise<DeptHeadPosition[]> {
  const assignments = await getActiveAssignmentsOf(employeeId, asOf);
  return assignments
    .filter((a) => a.position.orgUnitId === departmentId && a.position.jobLevel === DEPT_HEAD_JOB_LEVEL)
    .map((a) => ({
      assignmentId: a.id,
      positionId: a.positionId,
      positionCode: a.position.positionCode,
      jobTitle: a.position.job.jobTitle,
    }));
}

/**
 * Every departmentId this Employee currently holds level-3B approval
 * authority in, company-wide — used to populate the personal approvals
 * inbox (no single request's departmentId to scope by yet).
 */
export async function getDeptHeadDepartmentIds(
  employeeId: string | null | undefined,
  asOf?: Date
): Promise<string[]> {
  const assignments = await getActiveAssignmentsOf(employeeId, asOf);
  return [
    ...new Set(assignments.filter((a) => a.position.jobLevel === DEPT_HEAD_JOB_LEVEL).map((a) => a.position.orgUnitId)),
  ];
}

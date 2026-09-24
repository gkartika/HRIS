import { getActiveAssignmentsOf } from "@/lib/active-assignments";

// ACC-14/DEC-015: HR Manager authority is derived live from an active,
// effective-dated Position Assignment — never a stored AccountRole/flag —
// so access starts and ends automatically with the Assignment. Split out of
// permissions.ts on purpose (same reason as require-session.ts): this file
// needs Prisma, while permissions.ts stays dependency-free and pure so its
// predicates can be unit tested with plain arrays/objects.

export interface HrManagerPosition {
  assignmentId: string;
  positionId: string;
  positionCode: string;
  jobTitle: string;
  orgUnitName: string;
  assignmentType: string;
}

/**
 * Every Position currently granting HR Manager authority to this Employee,
 * via any ACTIVE Assignment (Primary or otherwise — ACC-14 doesn't restrict
 * to Primary) whose effective-dated range covers `asOf`. Half-open interval,
 * same convention as org-chart.ts: effectiveFrom <= asOf < effectiveTo.
 */
export async function getActiveHrManagerPositions(
  employeeId: string | null | undefined,
  asOf?: Date
): Promise<HrManagerPosition[]> {
  const assignments = await getActiveAssignmentsOf(employeeId, asOf);
  return assignments
    .filter((a) => a.position.grantsHrManagerAccess)
    .map((a) => ({
      assignmentId: a.id,
      positionId: a.positionId,
      positionCode: a.position.positionCode,
      jobTitle: a.position.job.jobTitle,
      orgUnitName: a.position.orgUnit.unitName,
      assignmentType: a.assignmentType,
    }));
}

import { prisma } from "@/lib/db";

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
  asOf: Date = new Date()
): Promise<HrManagerPosition[]> {
  if (!employeeId) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      employeeId,
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      position: { grantsHrManagerAccess: true },
    },
    include: { position: { include: { job: true, orgUnit: true } } },
  });

  return assignments.map((a) => ({
    assignmentId: a.id,
    positionId: a.positionId,
    positionCode: a.position.positionCode,
    jobTitle: a.position.job.jobTitle,
    orgUnitName: a.position.orgUnit.unitName,
    assignmentType: a.assignmentType,
  }));
}

export interface HrManagerCandidate {
  employeeId: string;
  positionId: string;
  assignmentType: string;
}

/**
 * Reverse of getActiveHrManagerPositions: every Employee company-wide
 * currently holding HR Manager authority, not just those held by one given
 * Employee. Used by Phase 3A's Level-3-employee P2 routing (COM-15).
 */
export async function getActiveHrManagerCandidates(asOf: Date = new Date()): Promise<HrManagerCandidate[]> {
  return prisma.assignment.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      position: { grantsHrManagerAccess: true },
    },
    select: { employeeId: true, positionId: true, assignmentType: true },
  });
}

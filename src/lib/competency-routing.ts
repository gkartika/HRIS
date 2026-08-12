import { prisma } from "@/lib/db";
import { LEVEL_3_JOB_LEVELS, resolveDepartmentId } from "@/lib/level3-scope";
import { getDeptHeadApprovers } from "@/lib/dept-head";
import { getActiveHrManagerCandidates } from "@/lib/hr-manager";
import { getActiveDirectorCandidates } from "@/lib/org-chart";
import { getSupervisorCandidatesForPosition } from "@/lib/manager-scope";

// COM-15: "Normal Employee: P1=Primary Position supervisor, P2=Department
// Head. Level 3 Employee: P1=Director, P2=HR Manager." An authority Position
// can have more than one current occupant (e.g. a Primary holder plus
// someone covering Acting) — pickSingleEvaluator resolves that down to the
// one CompetencyAssessment.p1/p2EmployeeId deterministically, so re-running
// routing (e.g. to display "who would P1 be") never flip-flops between
// equally-valid candidates.
export interface EvaluatorCandidate {
  employeeId: string;
  positionId: string;
  assignmentType: string;
}

export function pickSingleEvaluator(candidates: EvaluatorCandidate[]): EvaluatorCandidate | null {
  if (candidates.length === 0) return null;
  const primary = candidates.find((c) => c.assignmentType === "PRIMARY");
  if (primary) return primary;
  return [...candidates].sort((a, b) => a.employeeId.localeCompare(b.employeeId))[0];
}

export function isLevel3JobLevel(jobLevel: string): boolean {
  return (LEVEL_3_JOB_LEVELS as string[]).includes(jobLevel);
}

export interface ResolvedEvaluators {
  isLevel3: boolean;
  p1: EvaluatorCandidate | null;
  p2: EvaluatorCandidate | null;
}

/**
 * Resolves P1/P2 for one Employee's Primary Position, live, per COM-15.
 * `primaryPositionId` is passed in rather than re-derived from
 * Employee.currentPositionId so a cycle-open snapshot can resolve routing
 * against the Position captured at that moment (COM-08/COM-17), not
 * whatever the Employee's Primary Position happens to be later.
 */
export async function resolveCompetencyEvaluators(primaryPositionId: string, asOf: Date = new Date()): Promise<ResolvedEvaluators> {
  const position = await prisma.position.findUnique({
    where: { id: primaryPositionId },
    select: { jobLevel: true, orgUnitId: true },
  });
  if (!position) return { isLevel3: false, p1: null, p2: null };

  const isLevel3 = isLevel3JobLevel(position.jobLevel);

  if (isLevel3) {
    const [directorCandidates, hrManagerCandidates] = await Promise.all([
      getActiveDirectorCandidates(asOf),
      getActiveHrManagerCandidates(asOf),
    ]);
    return {
      isLevel3: true,
      p1: pickSingleEvaluator(directorCandidates),
      p2: pickSingleEvaluator(hrManagerCandidates),
    };
  }

  const departmentId = await resolveDepartmentId(position.orgUnitId);
  const [supervisorCandidates, deptHeadCandidates] = await Promise.all([
    getSupervisorCandidatesForPosition(primaryPositionId, asOf),
    departmentId ? getDeptHeadApprovers(departmentId, asOf) : Promise.resolve([]),
  ]);
  return {
    isLevel3: false,
    p1: pickSingleEvaluator(supervisorCandidates),
    p2: pickSingleEvaluator(deptHeadCandidates),
  };
}

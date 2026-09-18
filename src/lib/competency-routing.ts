import { prisma } from "@/lib/db";
import { LEVEL_3_JOB_LEVELS } from "@/lib/level3-scope";
import { getActiveDirectorCandidates } from "@/lib/org-chart";
import { getSupervisorCandidatesForPosition } from "@/lib/manager-scope";

// Revised per direct request: P2 (Department Head/HR Manager) dropped from
// Competency Assessment entirely — every assessment now routes to P1 only.
// The original blueprint routing was COM-15: "Normal Employee: P1=Primary
// Position supervisor, P2=Department Head. Level 3 Employee: P1=Director,
// P2=HR Manager" — this deliberately supersedes the P2 half of that rule,
// not a bug. An authority Position can have more than one current occupant
// (e.g. a Primary holder plus someone covering Acting) — pickSingleEvaluator
// resolves that down to the one CompetencyAssessment.p1EmployeeId
// deterministically, so re-running routing (e.g. to display "who would P1
// be") never flip-flops between equally-valid candidates.
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
}

/**
 * Resolves P1 for one Employee's Primary Position, live, per COM-15 (P1
 * half only — see the note above on P2 being dropped). `primaryPositionId`
 * is passed in rather than re-derived from Employee.currentPositionId so a
 * cycle-open snapshot can resolve routing against the Position captured at
 * that moment (COM-08/COM-17), not whatever the Employee's Primary Position
 * happens to be later.
 */
export async function resolveCompetencyEvaluators(primaryPositionId: string, asOf: Date = new Date()): Promise<ResolvedEvaluators> {
  const position = await prisma.position.findUnique({
    where: { id: primaryPositionId },
    select: { jobLevel: true },
  });
  if (!position) return { isLevel3: false, p1: null };

  const isLevel3 = isLevel3JobLevel(position.jobLevel);

  if (isLevel3) {
    const directorCandidates = await getActiveDirectorCandidates(asOf);
    return { isLevel3: true, p1: pickSingleEvaluator(directorCandidates) };
  }

  const supervisorCandidates = await getSupervisorCandidatesForPosition(primaryPositionId, asOf);
  return { isLevel3: false, p1: pickSingleEvaluator(supervisorCandidates) };
}

import { prisma } from "@/lib/db";
import { DEPT_HEAD_JOB_LEVEL } from "@/lib/dept-head";
import { resolveOrgUnitAncestorChain } from "@/lib/level3-scope";

export interface AbsenceApprovalChain {
  firstApproverPositionId: string | null;
  secondApproverPositionId: string | null;
}

/**
 * Resolves the approval chain for a new Absence request, per the
 * requester's OWN current Position. Walks up the requester's ancestor
 * OrgUnits (their own Team/Group/Section/Department, closest first) to
 * find the nearest one with its own AbsenceApproverConfig row — that's
 * stage 1. Whether there's a stage 2 is an explicit, per-unit choice
 * (`requiresSecondStage` on stage 1's own config row), NOT an automatic
 * consequence of how many ancestor tiers happen to have a row: a
 * Department needs its own row regardless, since some employees sit
 * directly on it with no Section/Group/Team beneath them — a Section using
 * that Department's row as ITS single stage must not be forced into 2
 * stages just because the Department also has a row for those other
 * employees' sake. Only when stage 1 opts in does resolution continue
 * further up to the next configured ancestor above it for stage 2. At
 * each stage, if the requester's own Position is that stage's configured
 * approver, it's skipped forward to the next configured ancestor instead
 * (self-approval guard) — same idea at every stage, not just the top.
 *
 * A 3B (Department Manager/Head) requester would otherwise BE their own
 * department's configured approver, so their approval always routes to
 * the Director instead — same fixed, non-configurable escalation already
 * used for Level-3 Competency evaluation routing (COM-15,
 * src/lib/competency-routing.ts).
 */
export async function resolveAbsenceApprovalChain(employeeId: string): Promise<AbsenceApprovalChain> {
  const empty: AbsenceApprovalChain = { firstApproverPositionId: null, secondApproverPositionId: null };

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee?.currentPositionId) return empty;

  const position = await prisma.position.findUnique({
    where: { id: employee.currentPositionId },
    select: { jobLevel: true, orgUnitId: true },
  });
  if (!position) return empty;

  if (position.jobLevel === DEPT_HEAD_JOB_LEVEL) {
    const director = await prisma.position.findFirst({
      where: { positionType: "DIRECTOR", reportsToPositionId: null },
      select: { id: true },
    });
    return { firstApproverPositionId: director?.id ?? null, secondApproverPositionId: null };
  }

  const ancestorChain = (await resolveOrgUnitAncestorChain(position.orgUnitId)).map((u) => u.id);
  const configs = await prisma.absenceApproverConfig.findMany({ where: { orgUnitId: { in: ancestorChain } } });
  const configByOrgUnitId = new Map(configs.map((c) => [c.orgUnitId, c]));

  const isUsable = (approverPositionId: string, exclude: string | null) =>
    approverPositionId !== employee.currentPositionId && approverPositionId !== exclude;

  let firstApproverPositionId: string | null = null;
  let firstStageIndex = -1;
  let escalates = false;
  for (let i = 0; i < ancestorChain.length; i++) {
    const config = configByOrgUnitId.get(ancestorChain[i]);
    if (config && isUsable(config.approverPositionId, null)) {
      firstApproverPositionId = config.approverPositionId;
      firstStageIndex = i;
      escalates = config.requiresSecondStage;
      break;
    }
  }

  let secondApproverPositionId: string | null = null;
  if (firstApproverPositionId && escalates) {
    for (let i = firstStageIndex + 1; i < ancestorChain.length; i++) {
      const config = configByOrgUnitId.get(ancestorChain[i]);
      if (config && isUsable(config.approverPositionId, firstApproverPositionId)) {
        secondApproverPositionId = config.approverPositionId;
        break;
      }
    }
  }

  return { firstApproverPositionId, secondApproverPositionId };
}

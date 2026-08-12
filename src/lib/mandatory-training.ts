import { prisma } from "@/lib/db";
import { resolveDepartmentId } from "@/lib/level3-scope";
import type { MandatoryTrainingRule } from "@/generated/prisma/client";

// TRN-13/ACC-23: "Mandatory Training rules must support Employee,
// Department, Job, Primary Position and Everyone. Resolve audience from
// effective organization and Primary Assignment data" — always resolved
// live at apply time, never cached, so a later org change is reflected the
// next time the rule is (re-)applied.
export async function resolveMandatoryTrainingAudience(rule: MandatoryTrainingRule): Promise<string[]> {
  if (rule.targetType === "EVERYONE") {
    const employees = await prisma.employee.findMany({ where: { activeFlag: true }, select: { id: true } });
    return employees.map((e) => e.id);
  }

  if (rule.targetType === "EMPLOYEE") {
    return rule.targetEmployeeId ? [rule.targetEmployeeId] : [];
  }

  if (rule.targetType === "PRIMARY_POSITION") {
    if (!rule.targetPositionId) return [];
    const employees = await prisma.employee.findMany({
      where: { activeFlag: true, currentPositionId: rule.targetPositionId },
      select: { id: true },
    });
    return employees.map((e) => e.id);
  }

  if (rule.targetType === "JOB") {
    if (!rule.targetJobId) return [];
    const employees = await prisma.employee.findMany({
      where: { activeFlag: true, currentPosition: { jobId: rule.targetJobId } },
      select: { id: true },
    });
    return employees.map((e) => e.id);
  }

  // DEPARTMENT: a Position's orgUnit may be a Section under the Department
  // — resolve each candidate's Department the same way level3-scope.ts's
  // dept-head/dept-employee scoping does, rather than a shallow direct-
  // match on orgUnitId.
  if (rule.targetType === "DEPARTMENT" && rule.targetDepartmentId) {
    const employees = await prisma.employee.findMany({
      where: { activeFlag: true, currentPosition: { isNot: null } },
      select: { id: true, currentPosition: { select: { orgUnitId: true } } },
    });
    const deptCache = new Map<string, string | null>();
    const matched: string[] = [];
    for (const e of employees) {
      const orgUnitId = e.currentPosition!.orgUnitId;
      if (!deptCache.has(orgUnitId)) deptCache.set(orgUnitId, await resolveDepartmentId(orgUnitId));
      if (deptCache.get(orgUnitId) === rule.targetDepartmentId) matched.push(e.id);
    }
    return matched;
  }

  return [];
}

export interface ApplyMandatoryTrainingRuleResult {
  audienceSize: number;
  newlyAssigned: number;
  alreadyAssigned: number;
}

// TRN-13: "...snapshot the result and prevent duplicate active
// assignments." A LearningAssignment already covering (employee, course)
// with a non-CANCELLED status is left untouched, regardless of which rule
// or Training Request originally created it — the Employee is not enrolled
// twice in the same course.
export async function applyMandatoryTrainingRule(
  ruleId: string,
  assignedByAccountId: string
): Promise<ApplyMandatoryTrainingRuleResult> {
  const rule = await prisma.mandatoryTrainingRule.findUniqueOrThrow({ where: { id: ruleId }, include: { course: true } });
  const audience = await resolveMandatoryTrainingAudience(rule);

  const existing = await prisma.learningAssignment.findMany({
    where: { courseId: rule.courseId, employeeId: { in: audience }, status: { not: "CANCELLED" } },
    select: { employeeId: true },
  });
  const alreadyAssignedIds = new Set(existing.map((e) => e.employeeId));

  const toAssign = audience.filter((id) => !alreadyAssignedIds.has(id));
  for (const employeeId of toAssign) {
    await prisma.learningAssignment.create({
      data: {
        employeeId,
        courseId: rule.courseId,
        sourceType: "MANDATORY_RULE",
        sourceMandatoryRuleId: rule.id,
        assignedByAccountId,
        status: "ASSIGNED",
        effectivenessRequiredSnapshot: rule.course.effectivenessRequired,
      },
    });
  }

  return { audienceSize: audience.length, newlyAssigned: toAssign.length, alreadyAssigned: alreadyAssignedIds.size };
}

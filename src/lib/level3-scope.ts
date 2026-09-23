import { prisma } from "@/lib/db";
import type { OrgUnit } from "@/generated/prisma/client";

// Perubahan Posisi refactor: "Level 3" submit eligibility is broader than
// the Department Head 3B approval tier (src/lib/dept-head.ts) — it's
// literally Position.jobLevel "3A" or "3B", matching both Section Head and
// Department Head/Manager tiers in the current org data. Kept in its own
// file for the same Prisma-backed/dependency-free-permissions.ts reason as
// hr-manager.ts and dept-head.ts.
export const LEVEL_3_JOB_LEVELS = ["3A", "3B"];

export interface Level3Position {
  assignmentId: string;
  positionId: string;
  positionCode: string;
  jobTitle: string;
  jobLevel: string;
  orgUnitId: string;
}

export async function getActiveLevel3Positions(
  employeeId: string | null | undefined,
  asOf: Date = new Date()
): Promise<Level3Position[]> {
  if (!employeeId) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      employeeId,
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      position: { jobLevel: { in: LEVEL_3_JOB_LEVELS } },
    },
    include: { position: { include: { job: true } } },
  });

  return assignments.map((a) => ({
    assignmentId: a.id,
    positionId: a.positionId,
    positionCode: a.position.positionCode,
    jobTitle: a.position.job.jobTitle,
    jobLevel: a.position.jobLevel,
    orgUnitId: a.position.orgUnitId,
  }));
}

/**
 * Self, then every ancestor OrgUnit up to the root, closest first — the
 * shared walk-up primitive resolveDepartmentId/resolveSectionId below and
 * the Absensi approval chain (absence-routing.ts's
 * resolveAbsenceApprovalChain) all build on, so there's exactly one
 * cycle-guarded parentUnit-walking loop in the codebase instead of one per
 * caller. Stops (without erroring) if the chain loops back on itself.
 */
export async function resolveOrgUnitAncestorChain(orgUnitId: string): Promise<OrgUnit[]> {
  const chain: OrgUnit[] = [];
  const visited = new Set<string>();
  let current = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    chain.push(current);
    if (!current.parentUnitId) break;
    current = await prisma.orgUnit.findUnique({ where: { id: current.parentUnitId } });
  }
  return chain;
}

/**
 * Nearest DEPARTMENT-type ancestor (or itself, if it already is one), or
 * null if the chain never reaches one — matches Section-under-Department
 * and Department-directly org shapes alike (FR-HC-01-09's "Section" +
 * "Department" fields).
 */
export async function resolveDepartmentId(orgUnitId: string): Promise<string | null> {
  const chain = await resolveOrgUnitAncestorChain(orgUnitId);
  return chain.find((u) => u.unitType === "DEPARTMENT")?.id ?? null;
}

/**
 * Nearest SECTION-type ancestor (or itself, if it already is one) — null
 * once the walk reaches a DEPARTMENT or runs out of chain first, matching
 * FR-HC-01-09's blank "Section" field for a Position with no intermediate
 * Section at all (including one sitting directly under a Department, or
 * under Group/Team tiers with no Section in between).
 */
export async function resolveSectionId(orgUnitId: string): Promise<string | null> {
  for (const unit of await resolveOrgUnitAncestorChain(orgUnitId)) {
    if (unit.unitType === "SECTION") return unit.id;
    if (unit.unitType === "DEPARTMENT") return null;
  }
  return null;
}

/**
 * Every departmentId this Employee currently holds Level-3 (3A/3B)
 * authority in, company-wide — used to populate the "pick an employee"
 * step when starting a new Perubahan Posisi request without one already
 * chosen (e.g. from the list page, rather than a specific Employee's own
 * detail page).
 */
export async function getLevel3DepartmentIds(
  employeeId: string | null | undefined,
  asOf: Date = new Date()
): Promise<string[]> {
  const positions = await getActiveLevel3Positions(employeeId, asOf);
  const departmentIds = await Promise.all(positions.map((p) => resolveDepartmentId(p.orgUnitId)));
  return [...new Set(departmentIds.filter((id): id is string => id !== null))];
}

/**
 * Level-3 (3A/3B) submit eligibility, scoped to the requester's own
 * Department — mirrors FR-HC-01-09's "Section Head / Department Head"
 * context (proposing changes for their own people), not company-wide.
 */
export async function isLevel3ForEmployeeDepartment(
  requesterEmployeeId: string | null | undefined,
  targetEmployeeId: string
): Promise<boolean> {
  const level3Positions = await getActiveLevel3Positions(requesterEmployeeId);
  if (level3Positions.length === 0) return false;

  const target = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: { currentPositionId: true },
  });
  if (!target?.currentPositionId) return false;
  const targetPosition = await prisma.position.findUnique({
    where: { id: target.currentPositionId },
    select: { orgUnitId: true },
  });
  if (!targetPosition) return false;
  const targetDepartmentId = await resolveDepartmentId(targetPosition.orgUnitId);
  if (!targetDepartmentId) return false;

  for (const pos of level3Positions) {
    const posDepartmentId = await resolveDepartmentId(pos.orgUnitId);
    if (posDepartmentId === targetDepartmentId) return true;
  }
  return false;
}

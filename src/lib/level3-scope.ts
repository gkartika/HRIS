import { prisma } from "@/lib/db";
import { getActiveAssignmentsOf, getOrgUnitMap } from "@/lib/active-assignments";
import { isMovementSubmitLevel } from "@/lib/movement";
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
  asOf?: Date
): Promise<Level3Position[]> {
  const assignments = await getActiveAssignmentsOf(employeeId, asOf);
  return assignments
    .filter((a) => LEVEL_3_JOB_LEVELS.includes(a.position.jobLevel))
    .map((a) => ({
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
  const units = await getOrgUnitMap();
  const chain: OrgUnit[] = [];
  const visited = new Set<string>();
  let current = units.get(orgUnitId);
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    chain.push(current);
    current = current.parentUnitId ? units.get(current.parentUnitId) : undefined;
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
  asOf?: Date
): Promise<string[]> {
  const positions = await getActiveLevel3Positions(employeeId, asOf);
  const departmentIds = await Promise.all(positions.map((p) => resolveDepartmentId(p.orgUnitId)));
  return [...new Set(departmentIds.filter((id): id is string => id !== null))];
}

// ---------- Perubahan Posisi: job level 2C and above (owner, 2026-10-28) ----------
// Same department scope as the Level 3 rules above, but the threshold is a job level of 2C or higher, so that Group and
// Section leaders below 3A can file too. Only Perubahan Posisi uses these; shift, training and the other modules keep
// their Level 3 rules.

export async function getActiveMovementSubmitPositions(employeeId: string | null | undefined, asOf?: Date): Promise<Level3Position[]> {
  const assignments = await getActiveAssignmentsOf(employeeId, asOf);
  return assignments
    .filter((a) => isMovementSubmitLevel(a.position.jobLevel))
    .map((a) => ({
      assignmentId: a.id,
      positionId: a.positionId,
      positionCode: a.position.positionCode,
      jobTitle: a.position.job.jobTitle,
      jobLevel: a.position.jobLevel,
      orgUnitId: a.position.orgUnitId,
    }));
}

export async function getMovementSubmitDepartmentIds(employeeId: string | null | undefined, asOf?: Date): Promise<string[]> {
  const positions = await getActiveMovementSubmitPositions(employeeId, asOf);
  const departmentIds = await Promise.all(positions.map((p) => resolveDepartmentId(p.orgUnitId)));
  return [...new Set(departmentIds.filter((id): id is string => id !== null))];
}

export async function isMovementSubmitterForEmployeeDepartment(
  requesterEmployeeId: string | null | undefined,
  targetEmployeeId: string,
  knownTargetOrgUnitId?: string | null
): Promise<boolean> {
  const ownDepartmentIds = await getMovementSubmitDepartmentIds(requesterEmployeeId);
  if (ownDepartmentIds.length === 0) return false;
  let targetOrgUnitId: string | null;
  if (knownTargetOrgUnitId !== undefined) {
    targetOrgUnitId = knownTargetOrgUnitId;
  } else {
    const target = await prisma.employee.findUnique({ where: { id: targetEmployeeId }, select: { currentPosition: { select: { orgUnitId: true } } } });
    targetOrgUnitId = target?.currentPosition?.orgUnitId ?? null;
  }
  if (!targetOrgUnitId) return false;
  const targetDepartmentId = await resolveDepartmentId(targetOrgUnitId);
  return !!targetDepartmentId && ownDepartmentIds.includes(targetDepartmentId);
}

/**
 * Level-3 (3A/3B) submit eligibility, scoped to the requester's own
 * Department — mirrors FR-HC-01-09's "Section Head / Department Head"
 * context (proposing changes for their own people), not company-wide.
 */
export async function isLevel3ForEmployeeDepartment(
  requesterEmployeeId: string | null | undefined,
  targetEmployeeId: string,
  // A caller that already loaded the target's Position passes its OrgUnit
  // (null = no Position) so the employee is not read a second time.
  knownTargetOrgUnitId?: string | null
): Promise<boolean> {
  const level3Positions = await getActiveLevel3Positions(requesterEmployeeId);
  if (level3Positions.length === 0) return false;

  let targetOrgUnitId: string | null;
  if (knownTargetOrgUnitId !== undefined) {
    targetOrgUnitId = knownTargetOrgUnitId;
  } else {
    const target = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { currentPosition: { select: { orgUnitId: true } } },
    });
    targetOrgUnitId = target?.currentPosition?.orgUnitId ?? null;
  }
  if (!targetOrgUnitId) return false;
  const targetDepartmentId = await resolveDepartmentId(targetOrgUnitId);
  if (!targetDepartmentId) return false;

  const ownDepartmentIds = await Promise.all(level3Positions.map((pos) => resolveDepartmentId(pos.orgUnitId)));
  return ownDepartmentIds.includes(targetDepartmentId);
}

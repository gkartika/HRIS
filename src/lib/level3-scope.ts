import { prisma } from "@/lib/db";

// Perubahan Posisi refactor: "Level 3" submit eligibility is broader than
// the Department Head 3B approval tier (src/lib/dept-head.ts) — it's
// literally Job.jobLevel "3A" or "3B", matching both Section Head and
// Department Head/Manager tiers in the current org data. Kept in its own
// file for the same Prisma-backed/dependency-free-permissions.ts reason as
// hr-manager.ts and dept-head.ts.
const LEVEL_3_JOB_LEVELS = ["3A", "3B"];

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
      position: { job: { jobLevel: { in: LEVEL_3_JOB_LEVELS } } },
    },
    include: { position: { include: { job: true } } },
  });

  return assignments.map((a) => ({
    assignmentId: a.id,
    positionId: a.positionId,
    positionCode: a.position.positionCode,
    jobTitle: a.position.job.jobTitle,
    jobLevel: a.position.job.jobLevel,
    orgUnitId: a.position.orgUnitId,
  }));
}

/**
 * Walks up OrgUnit.parentUnit until it finds a DEPARTMENT-type ancestor (or
 * itself, if it already is one). Returns null if the chain is broken/
 * circular or never reaches a Department — matches Section-under-Department
 * and Department-directly org shapes alike (FR-HC-01-09's "Section" +
 * "Department" fields).
 */
export async function resolveDepartmentId(orgUnitId: string): Promise<string | null> {
  let current = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
  const visited = new Set<string>();
  while (current) {
    if (current.unitType === "DEPARTMENT") return current.id;
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    if (!current.parentUnitId) return null;
    current = await prisma.orgUnit.findUnique({ where: { id: current.parentUnitId } });
  }
  return null;
}

/**
 * Section-tier ancestor (or the OrgUnit itself, if it already is one) —
 * null when the Position sits directly under a Department with no
 * intermediate Section, matching FR-HC-01-09's blank "Section" field in
 * that case.
 */
export async function resolveSectionId(orgUnitId: string): Promise<string | null> {
  const unit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
  return unit?.unitType === "SECTION" ? unit.id : null;
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

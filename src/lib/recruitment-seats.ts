import { prisma } from "@/lib/db";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";

// Vacant seats a recruitment request can be filled from. A seat belongs to a
// Department when it sits in that Department itself or anywhere below it
// (Section, Group, Team); decided 2026-10-08, because most seats sit under a
// Section or Group rather than directly under the Department. "Vacant" means
// not archived and no active Primary placement, the same test used when the
// employee is created (isPositionOccupiedByPrimary).
export async function findVacantPositionsInDepartment(departmentId: string, jobId?: string) {
  const [orgUnits, positions] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.position.findMany({
      where: {
        archived: false,
        ...(jobId ? { jobId } : {}),
        assignments: { none: { status: { in: ["ACTIVE", "SCHEDULED"] }, assignmentType: "PRIMARY" } },
      },
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
  ]);
  const tree = buildOrgUnitTree(orgUnits);
  return positions.filter((p) => tree.departmentOf(p.orgUnitId)?.id === departmentId);
}

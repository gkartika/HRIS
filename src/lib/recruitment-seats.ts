import { prisma } from "@/lib/db";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { STAYING_HOLDER, leavingHoldersOf } from "@/lib/position-occupancy";
import { leavingSeatLabel } from "@/lib/leaving-holder";

// Vacant seats a recruitment request can be filled from. A seat belongs to a
// Department when it sits in that Department itself or anywhere below it
// (Section, Group, Team); decided 2026-10-08, because most seats sit under a
// Section or Group rather than directly under the Department. "Vacant" means
// not archived and no active Primary placement, the same test used when the
// employee is created (isPositionOccupiedByPrimary).
// How many vacant seats each Jabatan has in a Department, for the request page. Same test as above, but it only
// reads the two ids it needs instead of loading every seat with its Jabatan and unit.
export async function countVacantSeatsByJob(departmentId: string): Promise<Record<string, number>> {
  const [orgUnits, positions] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.position.findMany({
      // a seat whose holder is leaving counts as (about to be) free, so the replacement can be placed in it
      where: { archived: false, assignments: { none: { status: { in: ["ACTIVE", "SCHEDULED"] }, assignmentType: "PRIMARY", employee: STAYING_HOLDER } } },
      select: { jobId: true, orgUnitId: true },
    }),
  ]);
  const tree = buildOrgUnitTree(orgUnits);
  const counts: Record<string, number> = {};
  for (const p of positions) {
    if (tree.departmentOf(p.orgUnitId)?.id === departmentId) counts[p.jobId] = (counts[p.jobId] ?? 0) + 1;
  }
  return counts;
}

export async function findVacantPositionsInDepartment(departmentId: string, jobId?: string) {
  const [orgUnits, positions] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.position.findMany({
      where: {
        archived: false,
        ...(jobId ? { jobId } : {}),
        assignments: { none: { status: { in: ["ACTIVE", "SCHEDULED"] }, assignmentType: "PRIMARY", employee: STAYING_HOLDER } },
      },
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
  ]);
  const tree = buildOrgUnitTree(orgUnits);
  const inDepartment = positions.filter((p) => tree.departmentOf(p.orgUnitId)?.id === departmentId);
  // seats whose holder is leaving carry a label for the picker ("akan kosong: Nama keluar 29 Okt")
  const leaving = await leavingHoldersOf(inDepartment.map((p) => p.id));
  return inDepartment.map((p) => {
    const l = leaving.get(p.id);
    return { ...p, leavingLabel: l ? leavingSeatLabel(l.name, l.lastWorkingDay) : null };
  });
}

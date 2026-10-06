import { activeAssignmentWhere } from "@/lib/active-assignments";
import { prisma } from "@/lib/db";

export interface OrgChartAssignment {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  assignmentType: string;
}

export interface OrgChartPosition {
  id: string;
  positionCode: string;
  jobTitle: string;
  jobLevel: string;
  orgUnitId: string;
  orgUnitName: string;
  positionType: string;
  positionStatus: string;
  reportsToPositionId: string | null;
  occupants: OrgChartAssignment[];
}

export interface OrgChartData {
  positions: OrgChartPosition[];
  asOfDate: string;
  rootCount: number;
  structureWarnings: string[];
}

// ORG-15/DEC-011: Director must be the single organization root, and every
// Department Head must ultimately report up to it. Computed fresh each time
// (never a stored flag) so a structure edit in /admin/positions is reflected
// immediately.
export function computeStructureWarnings(positions: OrgChartPosition[]): string[] {
  const warnings: string[] = [];
  const byId = new Map(positions.map((p) => [p.id, p]));

  const directorRoots = positions.filter(
    (p) => p.positionType === "DIRECTOR" && !p.reportsToPositionId
  );
  if (directorRoots.length === 0) {
    warnings.push("Tidak ada Posisi Direktur sebagai puncak hierarki organisasi.");
  } else if (directorRoots.length > 1) {
    warnings.push(
      `Ditemukan ${directorRoots.length} Posisi Direktur sebagai puncak — seharusnya hanya satu.`
    );
  }

  const otherRoots = positions.filter(
    (p) => !p.reportsToPositionId && p.positionType !== "DIRECTOR"
  );
  if (otherRoots.length > 0) {
    warnings.push(
      `${otherRoots.length} posisi lain tidak memiliki atasan (selain Direktur): ${otherRoots
        .map((p) => p.jobTitle)
        .join(", ")}. Tinjau di Pengaturan Organisasi > Posisi.`
    );
  }

  const departmentHeads = positions.filter((p) => p.positionType === "DEPARTMENT_HEAD");
  for (const deptHead of departmentHeads) {
    let current: OrgChartPosition | undefined = deptHead;
    const visited = new Set<string>();
    let reachesDirector = false;
    while (current?.reportsToPositionId) {
      if (visited.has(current.id)) break; // circular reference guard
      visited.add(current.id);
      const parent = byId.get(current.reportsToPositionId);
      if (!parent) break;
      if (parent.positionType === "DIRECTOR" && !parent.reportsToPositionId) {
        reachesDirector = true;
        break;
      }
      current = parent;
    }
    if (!reachesDirector) {
      warnings.push(`Kepala Departemen "${deptHead.jobTitle}" tidak berada di bawah hierarki Direktur.`);
    }
  }

  return warnings;
}

/**
 * Reconstructs the org chart as of a given date (DM-13): occupancy is always
 * computed live from Assignment rows for that date, never from a cached
 * "current" flag, so viewing a past or future date gives the correct answer.
 * A position may have zero occupants (vacant), one (the normal case), or more
 * than one (e.g. a Primary holder plus someone else covering it Acting).
 */
export async function getOrgChartData(asOfDate: Date): Promise<OrgChartData> {
  const [positions, assignments] = await Promise.all([
    prisma.position.findMany({
      where: { archived: false },
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
    // Half-open interval [effectiveFrom, effectiveTo): effectiveTo is the
    // first date the assignment is NO LONGER active, not the last date it
    // is. This matters at the exact moment of a Movement, where the old
    // assignment's effectiveTo is set to the new assignment's effectiveFrom
    // (same day) — with an inclusive upper bound both rows would show as
    // active on that boundary day; with this exclusive bound only the new
    // one does.
    prisma.assignment.findMany({
      where: {
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOfDate } }],
      },
      include: { employee: true },
    }),
  ]);

  const assignmentsByPosition = new Map<string, OrgChartAssignment[]>();
  for (const a of assignments) {
    const list = assignmentsByPosition.get(a.positionId) ?? [];
    list.push({
      assignmentId: a.id,
      employeeId: a.employeeId,
      employeeName: a.employee.fullLegalName,
      assignmentType: a.assignmentType,
    });
    assignmentsByPosition.set(a.positionId, list);
  }

  const chartPositions: OrgChartPosition[] = positions.map((p) => ({
    id: p.id,
    positionCode: p.positionCode,
    jobTitle: p.job.jobTitle,
    jobLevel: p.jobLevel,
    orgUnitId: p.orgUnitId,
    orgUnitName: p.orgUnit.unitName,
    positionType: p.positionType,
    positionStatus: p.positionStatus,
    reportsToPositionId: p.reportsToPositionId,
    occupants: assignmentsByPosition.get(p.id) ?? [],
  }));

  const rootCount = chartPositions.filter((p) => !p.reportsToPositionId).length;
  const structureWarnings = computeStructureWarnings(chartPositions);

  return {
    positions: chartPositions,
    asOfDate: asOfDate.toISOString().slice(0, 10),
    rootCount,
    structureWarnings,
  };
}

export interface DirectorCandidate {
  employeeId: string;
  positionId: string;
  assignmentType: string;
}

/**
 * Current holder(s) of the single Director root Position (ORG-15/DEC-011:
 * positionType DIRECTOR with no reportsToPositionId). Used by Phase 3A's
 * Level-3-employee P1 routing (COM-15) — company-wide, not department-scoped.
 */
export async function getActiveDirectorCandidates(asOf: Date = new Date()): Promise<DirectorCandidate[]> {
  const directorPositions = await prisma.position.findMany({
    where: { positionType: "DIRECTOR", reportsToPositionId: null },
    select: { id: true },
  });
  if (directorPositions.length === 0) return [];

  return prisma.assignment.findMany({
    where: {
      ...activeAssignmentWhere(asOf),
      positionId: { in: directorPositions.map((p) => p.id) },
    },
    select: { employeeId: true, positionId: true, assignmentType: true },
  });
}

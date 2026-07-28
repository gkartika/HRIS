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
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
    prisma.assignment.findMany({
      where: {
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
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
      employeeName: a.employee.preferredName ?? a.employee.fullLegalName,
      assignmentType: a.assignmentType,
    });
    assignmentsByPosition.set(a.positionId, list);
  }

  const chartPositions: OrgChartPosition[] = positions.map((p) => ({
    id: p.id,
    positionCode: p.positionCode,
    jobTitle: p.job.jobTitle,
    jobLevel: p.job.jobLevel,
    orgUnitId: p.orgUnitId,
    orgUnitName: p.orgUnit.unitName,
    positionType: p.positionType,
    positionStatus: p.positionStatus,
    reportsToPositionId: p.reportsToPositionId,
    occupants: assignmentsByPosition.get(p.id) ?? [],
  }));

  const rootCount = chartPositions.filter((p) => !p.reportsToPositionId).length;

  return {
    positions: chartPositions,
    asOfDate: asOfDate.toISOString().slice(0, 10),
    rootCount,
  };
}

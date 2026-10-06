import { cache } from "react";
import { prisma } from "@/lib/db";

// One shared loader for "which Position Assignments does this Employee hold
// right now" — the question hr-manager.ts, dept-head.ts and level3-scope.ts
// used to each ask the database separately (layout + page + dashboard asked
// it 4-7 times per request). Cached per request via React `cache`, so every
// authority check in one request shares a single query. Half-open interval,
// same convention as org-chart.ts: effectiveFrom <= asOf < effectiveTo.
function loadActiveAssignments(employeeId: string, asOf: Date) {
  return prisma.assignment.findMany({
    where: {
      employeeId,
      ...activeAssignmentWhere(asOf),
    },
    include: { position: { include: { job: true, orgUnit: true } } },
  });
}

const loadActiveAssignmentsNow = cache((employeeId: string) => loadActiveAssignments(employeeId, new Date()));

export type ActiveAssignment = Awaited<ReturnType<typeof loadActiveAssignments>>[number];

export async function getActiveAssignmentsOf(
  employeeId: string | null | undefined,
  asOf?: Date
): Promise<ActiveAssignment[]> {
  if (!employeeId) return [];
  return asOf ? loadActiveAssignments(employeeId, asOf) : loadActiveAssignmentsNow(employeeId);
}

// Whole org tree in one query per request, so walking a unit's ancestors is
// an in-memory lookup instead of one query per level.
export const getOrgUnitMap = cache(async () => {
  const units = await prisma.orgUnit.findMany();
  return new Map(units.map((u) => [u.id, u]));
});

// Prisma `where` fragment for "assignment in force at asOf" — one definition
// for the half-open interval effectiveFrom <= asOf < effectiveTo.
export function activeAssignmentWhere(asOf: Date) {
  return {
    status: "ACTIVE" as const,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
  };
}

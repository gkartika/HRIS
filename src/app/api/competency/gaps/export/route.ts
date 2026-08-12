import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isHrAdmin, isTrainingAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds, resolveDepartmentId } from "@/lib/level3-scope";
import { getActiveDirectorCandidates } from "@/lib/org-chart";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";

const HEADERS = ["employeeNumber", "employeeName", "position", "level3", "competencyAchievementPct", "companyValuesScore", "status"];

// COM-10/CTL-13: same visibility scope as /competency/gaps — Department
// Level 3 gets only their Department's non-Level-3 employees, the Director
// gets only Level-3 employees, HR/Training Admin get everything in the
// selected cycle.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = isHrAdmin(session) || isTrainingAdmin(session);
  const level3DepartmentIds = isAdmin ? [] : await getLevel3DepartmentIds(session.user.employeeId);
  const directorCandidates = isAdmin ? [] : await getActiveDirectorCandidates();
  const isDirector = directorCandidates.some((c) => c.employeeId === session.user.employeeId);

  if (!isAdmin && level3DepartmentIds.length === 0 && !isDirector) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycleId");
  if (!cycleId) return NextResponse.json({ error: "Missing cycleId" }, { status: 400 });

  const assignments = await prisma.competencyAssessment.findMany({
    where: { cycleId },
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      position: { select: { job: { select: { jobTitle: true } }, orgUnit: { select: { id: true } } } },
    },
    orderBy: { employee: { fullLegalName: "asc" } },
  });

  const deptCache = new Map<string, string | null>();
  async function departmentIdFor(orgUnitId: string): Promise<string | null> {
    if (!deptCache.has(orgUnitId)) deptCache.set(orgUnitId, await resolveDepartmentId(orgUnitId));
    return deptCache.get(orgUnitId) ?? null;
  }

  const rows = [];
  for (const a of assignments) {
    if (isAdmin) {
      rows.push(a);
      continue;
    }
    if (a.isLevel3AtSnapshot) {
      if (isDirector) rows.push(a);
      continue;
    }
    if (!a.position) continue;
    const deptId = await departmentIdFor(a.position.orgUnit.id);
    if (deptId && level3DepartmentIds.includes(deptId)) rows.push(a);
  }

  const csv = rowsToCsv(
    HEADERS,
    rows.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      employeeName: a.employee.fullLegalName,
      position: a.position?.job.jobTitle ?? "",
      level3: a.isLevel3AtSnapshot ? "Ya" : "Tidak",
      competencyAchievementPct: a.competencyAchievementPct !== null ? a.competencyAchievementPct.toFixed(1) : "",
      companyValuesScore: a.companyValuesScore !== null ? a.companyValuesScore.toFixed(1) : "",
      status: a.completedAt ? "Selesai" : "Berjalan",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "CompetencyAssessment",
    reason: `Exported ${rows.length} competency gap row(s) for cycle ${cycleId}`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="competency-gaps-${cycleId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

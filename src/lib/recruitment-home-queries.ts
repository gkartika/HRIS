import { prisma } from "@/lib/db";
import { ACTIVE_CANDIDATE_STATUSES, isExcellent } from "@/lib/recruitment-candidates";
import { listCandidates, progressOf, type CandidateRow } from "@/lib/recruitment-queries";
import { FULFILLABLE_STATUSES, loadPlanContext, possibleTests, readinessProblems } from "@/lib/recruitment-service";
import { loadDashboardData } from "@/lib/recruitment-dashboard-data";
import { computeDashboard, parseDashboardFilters } from "@/lib/recruitment-dashboard";
import { DAY_MS } from "@/lib/company-time";
import { buildRecruitmentRows, buildRecruitmentTiles, buildSetupWarnings, recRowCounts, type HomeCandidate, type HomeVacancy } from "@/lib/recruitment-home";

function toHomeCandidate(c: CandidateRow): HomeCandidate {
  return {
    id: c.id,
    requestId: c.requestId,
    requestNumber: c.request.requestNumber,
    jobLabel: c.request.job?.jobTitle ?? c.request.department.unitName,
    fullName: c.fullName,
    status: c.status,
    statusChangedAt: c.statusChangedAt,
    progress: progressOf(c),
    interviewAt: c.interview?.scheduledAt ?? null,
    movementStatus: c.movementRequest?.status ?? null,
    excellent: c.tests.some((t) => t.passed === true && isExcellent(t.scorePercent, t.testType.excellentScore)),
  };
}

// Everything the Admin Rekrutmen Beranda shows. All queries start together.
export async function getRecruitmentHomeData() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const lastMonthFilters = parseDashboardFilters({}, []);

  const [active, ctx, requests, month] = await Promise.all([
    listCandidates({ status: { in: ACTIVE_CANDIDATE_STATUSES } }, 400),
    loadPlanContext(),
    prisma.recruitmentRequest.findMany({
      relationLoadStrategy: "join",
      where: { status: { in: FULFILLABLE_STATUSES } },
      orderBy: { requestDate: "desc" },
      select: {
        id: true,
        requestNumber: true,
        status: true,
        openFor: true,
        accessCode: true,
        requestedHeadcount: true,
        jobId: true,
        testsCustomized: true,
        testTypeIds: true,
        job: { select: { jobTitle: true } },
        department: { select: { unitName: true } },
        _count: { select: { fulfillments: true } },
      },
    }),
    loadDashboardData(lastMonthFilters, { from: monthAgo, to: now }),
  ]);

  const candidates = active.map(toHomeCandidate);
  const applicantsPerRequest = new Map<string, number>();
  for (const c of candidates) applicantsPerRequest.set(c.requestId, (applicantsPerRequest.get(c.requestId) ?? 0) + 1);

  const vacancies: (HomeVacancy & { testTypeIds: string[] })[] = requests.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    jobLabel: r.job?.jobTitle ?? r.department.unitName,
    openFor: r.openFor,
    accessCode: r.accessCode,
    applicants: applicantsPerRequest.get(r.id) ?? 0,
    seatsLeft: Math.max(0, r.requestedHeadcount - r._count.fulfillments),
    problems: readinessProblems(ctx, r, r._count.fulfillments),
    testTypeIds: possibleTests(ctx, r).map((t) => t.id),
  }));
  const open = vacancies.filter((v) => v.openFor !== "NONE");

  const result = computeDashboard({ candidates: month.candidates, requests: month.requests, range: { from: monthAgo, to: now }, now });
  const hiredBy = (source: "EXTERNAL" | "INTERNAL") => result.bySource.find((s) => s.source === source)?.hired ?? 0;
  const lastMonth = { hiredExternal: hiredBy("EXTERNAL"), hiredInternal: hiredBy("INTERNAL"), avgDaysToHire: result.timeToHire.days };

  const rows = buildRecruitmentRows(candidates, now);
  const tiles = buildRecruitmentTiles({ candidates, rows, vacancies, unopened: vacancies.length - open.length, lastMonth, now });
  const warnings = buildSetupWarnings({ types: ctx.types, openVacancies: open });

  return {
    rows,
    counts: recRowCounts(rows),
    tiles,
    warnings,
    vacancies: open,
    summary: {
      applicants: result.funnel[0].count,
      passed: result.funnel[1].count,
      hired: lastMonth.hiredExternal + lastMonth.hiredInternal,
      hiringRate: result.hiringRate.percent,
      avgDaysToHire: result.timeToHire.days,
    },
  };
}

export type RecruitmentHomeData = Awaited<ReturnType<typeof getRecruitmentHomeData>>;

import { prisma } from "@/lib/db";
import { ACTIVE_CANDIDATE_STATUSES, isExcellent } from "@/lib/recruitment-candidates";
import { listCandidates, progressOf, type CandidateRow } from "@/lib/recruitment-queries";
import { FULFILLABLE_STATUSES, loadPlanContext, possibleTests, readinessProblems } from "@/lib/recruitment-service";
import { loadDashboardData } from "@/lib/recruitment-dashboard-data";
import { computeDashboard, parseDashboardFilters } from "@/lib/recruitment-dashboard";
import { DAY_MS } from "@/lib/company-time";
import {
  buildHomeStats,
  buildRecruitmentRows,
  buildSetupWarnings,
  buildUpcomingInterviews,
  buildVacancyProgress,
  buildWaitingItems,
  recRowCounts,
  type HomeCandidate,
  type HomeRequest,
} from "@/lib/recruitment-home";

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
    interviewMode: c.interview?.mode ?? null,
    offerSentAt: c.offer?.sentAt ?? null,
    movementStatus: c.movementRequest?.status ?? null,
    excellent: c.tests.some((t) => t.passed === true && isExcellent(t.scorePercent, t.testType.excellentScore)),
  };
}

// Everything the Admin Rekrutmen Beranda shows. All queries start together.
export async function getRecruitmentHomeData() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const lastMonthFilters = parseDashboardFilters({}, []);

  const [active, ctx, requests, month, applicantTotals] = await Promise.all([
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
        heldAt: true,
        approvedAt: true,
        publicDescription: true,
        testsCustomized: true,
        testTypeIds: true,
        job: { select: { jobTitle: true } },
        department: { select: { unitName: true } },
        _count: { select: { fulfillments: true } },
      },
    }),
    loadDashboardData(lastMonthFilters, { from: monthAgo, to: now }),
    prisma.recruitmentCandidate.groupBy({ by: ["requestId"], _count: { _all: true } }),
  ]);

  const candidates = active.map(toHomeCandidate);
  const totalByRequest = new Map(applicantTotals.map((t) => [t.requestId, t._count._all]));

  const homeRequests: HomeRequest[] = requests.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    jobLabel: r.job?.jobTitle ?? r.department.unitName,
    department: r.department.unitName,
    headcount: r.requestedHeadcount,
    filled: r._count.fulfillments,
    approvedAt: r.approvedAt,
    heldAt: r.heldAt,
    opened: r.openFor !== "NONE",
    hasDetail: !!r.publicDescription?.trim(),
    problems: readinessProblems(ctx, r, r._count.fulfillments),
    totalApplicants: totalByRequest.get(r.id) ?? 0,
  }));
  const openVacancies = requests
    .filter((r) => r.openFor !== "NONE")
    .map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      testTypeIds: possibleTests(ctx, r).map((t) => t.id),
      problems: homeRequests.find((h) => h.id === r.id)?.problems ?? [],
    }));

  const result = computeDashboard({ candidates: month.candidates, requests: month.requests, range: { from: monthAgo, to: now }, now });
  const hiredBy = (source: "EXTERNAL" | "INTERNAL") => result.bySource.find((s) => s.source === source)?.hired ?? 0;

  const rows = buildRecruitmentRows(candidates, now, homeRequests);
  const waiting = buildWaitingItems(candidates, now);
  const upcoming = buildUpcomingInterviews(candidates, now);
  const vacancies = buildVacancyProgress({ requests: homeRequests, candidates, rows, waiting, now });
  const warnings = buildSetupWarnings({ types: ctx.types, openVacancies, assessmentActive: ctx.assessment !== null });

  return {
    rows,
    counts: recRowCounts(rows),
    stats: buildHomeStats({ rows, upcoming, waiting, vacancies, now }),
    waiting,
    upcoming,
    vacancies,
    warnings,
    summary: {
      applicants: result.funnel[0].count,
      passed: result.funnel[1].count,
      hired: hiredBy("EXTERNAL") + hiredBy("INTERNAL"),
      hiringRate: result.hiringRate.percent,
      avgDaysToHire: result.timeToHire.days,
    },
  };
}

export type RecruitmentHomeData = Awaited<ReturnType<typeof getRecruitmentHomeData>>;

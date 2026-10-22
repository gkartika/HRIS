import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestedJobLevel } from "@/generated/prisma/enums";
import type { DashboardCandidate, DashboardFilters, DashboardRange, DashboardRequest } from "@/lib/recruitment-dashboard";
import { countBySource } from "@/lib/recruitment-source";

// Loads the rows the dashboard needs, already narrowed by department, level and source.
// Applicants are fetched when they applied inside the period OR their last status change falls
// inside it or later (every pass / invitation / hire date lies at or before that change), so a hire
// made this month for someone who applied last year still counts.
export async function loadDashboardData(filters: DashboardFilters, range: DashboardRange) {
  const requestWhere: Prisma.RecruitmentRequestWhereInput = {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.level ? { requestedJobLevel: filters.level as RequestedJobLevel } : {}),
  };

  const candidateWhere: Prisma.RecruitmentCandidateWhereInput = {
    request: requestWhere,
    ...(filters.source ? { source: filters.source } : {}),
    ...(range.from || range.to
      ? {
          OR: [
            { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } },
            ...(range.from ? [{ statusChangedAt: { gte: range.from } }] : []),
          ],
        }
      : {}),
  };

  // Positions filled in the period, by how they were filled (new hire, internal applicant, Mutasi). The source
  // filter narrows it to that kind of applicant, so it also hides Mutasi.
  const fulfillmentWhere: Prisma.RecruitmentRequestFulfillmentWhereInput = {
    recruitmentRequest: requestWhere,
    ...(filters.source ? { source: filters.source === "EXTERNAL" ? "RECRUITMENT_EXTERNAL" : "RECRUITMENT_INTERNAL" } : {}),
    ...(range.from || range.to ? { linkedAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
  };

  const [candidates, requests, departments, filledRows] = await Promise.all([
    prisma.recruitmentCandidate.findMany({
      relationLoadStrategy: "join",
      where: candidateWhere,
      select: {
        id: true,
        source: true,
        status: true,
        createdAt: true,
        statusChangedAt: true,
        decidedAt: true,
        movementRequestId: true,
        request: { select: { departmentId: true } },
        tests: { select: { passed: true, submittedAt: true, reviewedAt: true } },
        interview: { select: { invitationSentAt: true, createdAt: true } },
        offer: { select: { id: true } },
      },
    }),
    prisma.recruitmentRequest.findMany({
      relationLoadStrategy: "join",
      where: { ...requestWhere, status: { notIn: ["DRAFT", "PENDING_DEPT_HEAD", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "RETURNED"] } },
      select: { id: true, departmentId: true, status: true, approvedAt: true, fulfillments: { select: { linkedAt: true } } },
    }),
    // Departments to pick from: every one that has a request.
    prisma.orgUnit.findMany({
      relationLoadStrategy: "join",
      where: { recruitmentRequests: { some: {} } },
      orderBy: { unitName: "asc" },
      select: { id: true, unitName: true },
    }),
    prisma.recruitmentRequestFulfillment.findMany({ where: fulfillmentWhere, select: { source: true } }),
  ]);

  const dashboardCandidates: DashboardCandidate[] = candidates.map((c) => ({
    id: c.id,
    source: c.source,
    status: c.status,
    appliedAt: c.createdAt,
    statusChangedAt: c.statusChangedAt,
    decidedAt: c.decidedAt,
    departmentId: c.request.departmentId,
    interviewInvitedAt: c.interview ? c.interview.invitationSentAt ?? c.interview.createdAt : null,
    hasOffer: c.offer !== null,
    hasMovement: c.movementRequestId !== null,
    tests: c.tests.map((t) => ({ passed: t.passed, doneAt: t.reviewedAt ?? t.submittedAt })),
  }));

  const dashboardRequests: DashboardRequest[] = requests.map((r) => ({
    id: r.id,
    departmentId: r.departmentId,
    status: r.status,
    approvedAt: r.approvedAt,
    filledAt: r.status === "FILLED" && r.fulfillments.length ? new Date(Math.max(...r.fulfillments.map((f) => f.linkedAt.getTime()))) : null,
  }));

  return { candidates: dashboardCandidates, requests: dashboardRequests, departments, filled: countBySource(filledRows.map((f) => f.source)) };
}

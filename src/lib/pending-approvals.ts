import type { Session } from "next-auth";
import { EFFECTIVENESS_DUE_WHERE } from "@/lib/training";
import { prisma } from "@/lib/db";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { isHrAdmin, isGaAdmin } from "@/lib/permissions";
import { getDirectReportEmployeeIds } from "@/lib/manager-scope";
import { getEmployeePositionInfo } from "@/lib/current-position";

// Shared by the Dashboard's merged "Perlu Persetujuan Anda" section (this
// used to also back a standalone /approvals page, now removed — see
// docs/DECISIONS.md history). Every query here is unchanged in shape from
// the original /approvals implementation — this file only moves it, plus
// Absence, Competency Assessment and Training Effectiveness, which never
// had a home on /approvals.
//
// Performance: every query below is independent of every OTHER query in
// its own group — only a handful of derived flags (isHrManager, isDeptHead,
// the GA approver flags, absencePositionIds, directReportIds) gate which
// queries in the NEXT group actually run. Grouped into 3 Promise.all
// stages by that real dependency order instead of ~20 one-after-another
// awaits, so total latency is bounded by 3 round trips' worth of the
// slowest query in each stage, not the sum of all ~20.
export async function getPendingApprovals(session: Session) {
  const employeeId = session.user.employeeId ?? "__none__";

  // The seat I hold right now. A first/second approver is "whoever currently
  // holds the configured Position", so the pending absence requests are asked
  // for by that seat directly instead of loading every company-wide request
  // and matching holders in memory.
  const me = session.user.employeeId ? await getEmployeePositionInfo(session.user.employeeId) : null;
  const myPositionId = me?.activeFlag ? me.currentPositionId : null;
  const absenceRow = {
    id: true,
    employeeId: true,
    startDate: true,
    endDate: true,
    employee: { select: { fullLegalName: true } },
    absenceType: { select: { label: true } },
  } as const;

  // Stage 1 — needs only employeeId/session, nothing computed below.
  const [
    hrManagerPositions,
    deptHeadDepartmentIds,
    pendingOwnEvaluations,
    pendingAbsenceHrAdmin,
    pendingAbsenceFirstApprover,
    pendingAbsenceSecondApprover,
    pendingCompetencyAssessments,
    directReportIds,
    pendingRecruitmentReviews,
    pendingRecruitmentInterviews,
  ] = await Promise.all([
    getActiveHrManagerPositions(session.user.employeeId),
    getDeptHeadDepartmentIds(session.user.employeeId),
    prisma.evaluation.findMany({
      where: {
        status: "RELEASED",
        OR: [
          { p1EmployeeId: employeeId, p1SubmittedAt: null },
          { p2EmployeeId: employeeId, p2SubmittedAt: null },
        ],
      },
      include: { employee: true },
      orderBy: { releasedAt: "asc" },
    }),
    // Absence: never listed on the old /approvals page — the configured
    // first approver for a SUBMITTED request isn't one global authority
    // (unlike HR Manager/Dept Head), so pending requests are fetched once
    // and matched against this employee's current Position in memory
    // rather than N one-off holder lookups (see Stage 2/3 below).
    isHrAdmin(session)
      ? prisma.absenceRequest.findMany({
          where: { status: "PENDING_HR_ADMIN" },
          select: absenceRow,
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    myPositionId
      ? prisma.absenceRequest.findMany({
          where: { status: "SUBMITTED", firstApproverPositionId: myPositionId },
          select: absenceRow,
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    myPositionId
      ? prisma.absenceRequest.findMany({
          where: { status: "PENDING_SECOND_APPROVER", secondApproverPositionId: myPositionId },
          select: absenceRow,
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    // Competency Assessment P1 scoring (P2 dropped from the workflow — see
    // lib/competency.ts/competency-routing.ts) — same "I'm the evaluator,
    // not the evaluatee" shape as pendingOwnEvaluations above.
    session.user.employeeId
      ? prisma.competencyAssessment.findMany({
          where: { p1EmployeeId: session.user.employeeId, p1SubmittedAt: null },
          include: { employee: true, cycle: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    getDirectReportEmployeeIds(session.user.employeeId),
    // Rekrutmen: an essay HR Admin asked me to judge, or an interview I must score. Both start at
    // the table that holds the names, so each is one query plus one parallel step.
    session.user.employeeId
      ? prisma.recruitmentCandidateTest.findMany({
          where: { status: "SUBMITTED", passed: null, reviewers: { some: { employeeId: session.user.employeeId } } },
          select: { id: true, testType: { select: { name: true } }, candidate: { select: { fullName: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    session.user.employeeId
      ? prisma.recruitmentInterview.findMany({
          where: {
            interviewers: { some: { employeeId: session.user.employeeId, submittedAt: null } },
            candidate: { status: "INTERVIEWING", interviewDecision: null },
          },
          select: { id: true, scheduledAt: true, candidate: { select: { fullName: true } } },
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const isHrManager = hrManagerPositions.length > 0;
  const isDeptHead = deptHeadDepartmentIds.length > 0;

  // Stage 2 — depends on Stage 1's results (isHrManager/isDeptHead/
  // deptHeadDepartmentIds, directReportIds).
  const [
    pendingRequests,
    pendingMovements,
    pendingDeptHeadRequests,
    pendingDeptHeadMovements,
    pendingDeptHeadRenewals,
    pendingHrManagerRenewals,
    pendingDeptHeadTrainingRequests,
    pendingEffectivenessTasks,
  ] = await Promise.all([
    isHrManager
      ? prisma.recruitmentRequest.findMany({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
          include: { department: true, job: true },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    isHrManager
      ? prisma.movementRequest.findMany({
          where: { status: "SUBMITTED" },
          include: { employee: true, currentPosition: { include: { job: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    isDeptHead
      ? prisma.recruitmentRequest.findMany({
          where: { status: "PENDING_DEPT_HEAD", departmentId: { in: deptHeadDepartmentIds } },
          include: { department: true, job: true },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    isDeptHead
      ? prisma.movementRequest.findMany({
          where: {
            status: "PENDING_DEPT_HEAD",
            currentPosition: {
              orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
            },
          },
          include: { employee: true, currentPosition: { include: { job: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    isDeptHead
      ? prisma.contractRenewalCase.findMany({
          where: {
            status: "EVALUATION_SENT",
            evaluation: { status: "COMPLETED" },
            snapshotPosition: {
              orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
            },
          },
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    isHrManager
      ? prisma.contractRenewalCase.findMany({
          where: { status: "PENDING_HR_MANAGER" },
          include: { employee: true },
          orderBy: { deptHeadRecommendedAt: "asc" },
        })
      : Promise.resolve([]),
    isDeptHead
      ? prisma.trainingRequest.findMany({
          where: { status: "SUBMITTED", departmentIdSnapshot: { in: deptHeadDepartmentIds } },
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    // Training effectiveness (D+30) tasks — "the Primary Position
    // supervisor completes it" (TRN-04/TRN-07) — scoped to this employee's
    // own direct reports (one query) rather than N one-off
    // isDirectManagerOfEmployee lookups, same pattern as the page's own
    // candidate list.
    directReportIds.length
      ? prisma.learningAssignment.findMany({
          where: {
            employeeId: { in: directReportIds },
            ...EFFECTIVENESS_DUE_WHERE,
          },
          include: { employee: true, course: { select: { title: true } } },
          orderBy: { effectivenessDueDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // GA Admin decides all three GA Operations approval points directly now —
  // no separate configurable approver Position to resolve holders for.
  const isGaAdminUser = isGaAdmin(session);

  // Stage 3 — depends on Stage 2's approver flag.
  const [pendingGaNewAssetNeeds, pendingGaLossReviews, pendingGaDisposals] = await Promise.all([
    isGaAdminUser
      ? prisma.gaRequest.findMany({
          where: { status: "PENDING_APPROVAL" },
          include: { requester: true, asset: { select: { assetCode: true, assetName: true } } },
          orderBy: { verifiedAt: "asc" },
        })
      : Promise.resolve([]),
    isGaAdminUser
      ? prisma.gaRequest.findMany({
          // A loss report is decided straight from SUBMITTED now; PENDING_LOSS_REVIEW is the old waiting state.
          where: { requestType: "LOSS", status: { in: ["SUBMITTED", "PENDING_LOSS_REVIEW"] } },
          include: { requester: true, asset: { select: { assetCode: true, assetName: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    isGaAdminUser
      ? prisma.disposalCase.findMany({
          // A disposal draft is approved (and the asset taken out) in one step now; PENDING_APPROVAL is the old waiting state.
          where: { status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
          include: { asset: { select: { assetCode: true, assetName: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    hrManagerPositions,
    deptHeadDepartmentIds,
    isHrManager,
    isDeptHead,
    pendingOwnEvaluations,
    pendingGaNewAssetNeeds,
    pendingGaLossReviews,
    pendingGaDisposals,
    pendingRequests,
    pendingMovements,
    pendingDeptHeadRequests,
    pendingDeptHeadMovements,
    pendingDeptHeadRenewals,
    pendingHrManagerRenewals,
    pendingDeptHeadTrainingRequests,
    pendingAbsenceHrAdmin,
    pendingAbsenceFirstApprover,
    pendingAbsenceSecondApprover,
    pendingCompetencyAssessments,
    pendingEffectivenessTasks,
    pendingRecruitmentReviews,
    pendingRecruitmentInterviews,
  };
}

export type PendingApprovals = Awaited<ReturnType<typeof getPendingApprovals>>;

// Total count across every source — used by the Dashboard's section badge.
export function countPendingApprovals(p: PendingApprovals): number {
  return (
    p.pendingOwnEvaluations.length +
    p.pendingGaNewAssetNeeds.length +
    p.pendingGaLossReviews.length +
    p.pendingGaDisposals.length +
    p.pendingRequests.length +
    p.pendingMovements.length +
    p.pendingDeptHeadRequests.length +
    p.pendingDeptHeadMovements.length +
    p.pendingDeptHeadRenewals.length +
    p.pendingHrManagerRenewals.length +
    p.pendingDeptHeadTrainingRequests.length +
    p.pendingAbsenceHrAdmin.length +
    p.pendingAbsenceFirstApprover.length +
    p.pendingAbsenceSecondApprover.length +
    p.pendingCompetencyAssessments.length +
    p.pendingEffectivenessTasks.length +
    p.pendingRecruitmentReviews.length +
    p.pendingRecruitmentInterviews.length
  );
}

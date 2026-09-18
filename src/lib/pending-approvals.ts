import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { canDecideAsConfiguredGaApprover, isHrAdmin } from "@/lib/permissions";
import { canDecideAbsenceRequestAsFirstApprover } from "@/lib/permissions";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { getDirectReportEmployeeIds } from "@/lib/manager-scope";

// Shared by /approvals (src/app/(app)/approvals/page.tsx) and the Dashboard's
// merged "Perlu Persetujuan Anda" section, so both surfaces enumerate the
// exact same pending items from one place instead of drifting apart. Every
// query here is unchanged from what /approvals already computed on its own
// before this extraction — this file only moves it, plus adds Absence
// (which /approvals never listed) since the Dashboard now needs it too.
export async function getPendingApprovals(session: Session) {
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);
  const employeeId = session.user.employeeId ?? "__none__";
  const isHrManager = hrManagerPositions.length > 0;
  const isDeptHead = deptHeadDepartmentIds.length > 0;

  const pendingOwnEvaluations = await prisma.evaluation.findMany({
    where: {
      status: "RELEASED",
      OR: [
        { p1EmployeeId: employeeId, p1SubmittedAt: null },
        { p2EmployeeId: employeeId, p2SubmittedAt: null },
      ],
    },
    include: { employee: true },
    orderBy: { releasedAt: "asc" },
  });

  const [newAssetNeedConfig, lossReviewConfig, disposalConfig] = await Promise.all([
    prisma.gaApprovalConfig.findUnique({ where: { approvalType: "NEW_ASSET_NEED" } }),
    prisma.gaApprovalConfig.findUnique({ where: { approvalType: "LOSS_REVIEW" } }),
    prisma.gaApprovalConfig.findUnique({ where: { approvalType: "DISPOSAL" } }),
  ]);
  const [newAssetNeedHolderIds, lossReviewHolderIds, disposalHolderIds] = await Promise.all([
    getCurrentHolderEmployeeIds(newAssetNeedConfig?.approverPositionId ?? null),
    getCurrentHolderEmployeeIds(lossReviewConfig?.approverPositionId ?? null),
    getCurrentHolderEmployeeIds(disposalConfig?.approverPositionId ?? null),
  ]);
  const isNewAssetNeedApprover = canDecideAsConfiguredGaApprover(session.user.employeeId, newAssetNeedHolderIds);
  const isLossReviewApprover = canDecideAsConfiguredGaApprover(session.user.employeeId, lossReviewHolderIds);
  const isDisposalApprover = canDecideAsConfiguredGaApprover(session.user.employeeId, disposalHolderIds);

  const [pendingGaNewAssetNeeds, pendingGaLossReviews, pendingGaDisposals] = await Promise.all([
    isNewAssetNeedApprover
      ? prisma.gaRequest.findMany({
          where: { status: "PENDING_APPROVAL" },
          include: { requester: true, asset: { select: { assetCode: true, assetName: true } } },
          orderBy: { verifiedAt: "asc" },
        })
      : Promise.resolve([]),
    isLossReviewApprover
      ? prisma.gaRequest.findMany({
          where: { status: "PENDING_LOSS_REVIEW" },
          include: { requester: true, asset: { select: { assetCode: true, assetName: true } } },
          orderBy: { verifiedAt: "asc" },
        })
      : Promise.resolve([]),
    isDisposalApprover
      ? prisma.disposalCase.findMany({
          where: { status: "PENDING_APPROVAL" },
          include: { asset: { select: { assetCode: true, assetName: true } } },
          orderBy: { submittedForApprovalAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const [
    pendingRequests,
    pendingMovements,
    pendingDeptHeadRequests,
    pendingDeptHeadMovements,
    pendingDeptHeadRenewals,
    pendingDeptHeadOffboarding,
    pendingHrManagerRenewals,
    pendingHrManagerOffboarding,
    pendingDeptHeadTrainingRequests,
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
    isDeptHead
      ? prisma.offboardingCase.findMany({
          where: {
            status: "PENDING_DEPT_HEAD",
            employee: {
              currentPosition: {
                orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
              },
            },
          },
          include: { employee: true },
          orderBy: { reportedAt: "asc" },
        })
      : Promise.resolve([]),
    isHrManager
      ? prisma.contractRenewalCase.findMany({
          where: { status: "PENDING_HR_MANAGER" },
          include: { employee: true },
          orderBy: { deptHeadRecommendedAt: "asc" },
        })
      : Promise.resolve([]),
    isHrManager
      ? prisma.offboardingCase.findMany({
          where: { status: "PENDING_HR_MANAGER" },
          include: { employee: true },
          orderBy: { reportedAt: "asc" },
        })
      : Promise.resolve([]),
    isDeptHead
      ? prisma.trainingRequest.findMany({
          where: { status: "SUBMITTED", departmentIdSnapshot: { in: deptHeadDepartmentIds } },
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Absence: never listed on /approvals before — the configured first
  // approver for a SUBMITTED request isn't one global authority (unlike HR
  // Manager/Dept Head), so pending requests are fetched once and matched
  // against this employee's current Position in memory rather than N
  // one-off holder lookups.
  const pendingAbsenceHrAdmin = isHrAdmin(session)
    ? await prisma.absenceRequest.findMany({
        where: { status: "PENDING_HR_ADMIN" },
        include: { employee: true, absenceType: true },
        orderBy: { submittedAt: "asc" },
      })
    : [];

  const submittedAbsenceRequests = session.user.employeeId
    ? await prisma.absenceRequest.findMany({
        where: { status: "SUBMITTED", firstApproverPositionId: { not: null } },
        include: { employee: true, absenceType: true },
        orderBy: { submittedAt: "asc" },
      })
    : [];
  const absencePositionIds = [...new Set(submittedAbsenceRequests.map((r) => r.firstApproverPositionId!))];
  const absencePositionHolders = absencePositionIds.length
    ? await prisma.employee.findMany({
        where: { currentPositionId: { in: absencePositionIds }, activeFlag: true },
        select: { id: true, currentPositionId: true },
      })
    : [];
  const absenceHolderIdsByPosition = new Map<string, string[]>();
  for (const h of absencePositionHolders) {
    const list = absenceHolderIdsByPosition.get(h.currentPositionId!) ?? [];
    list.push(h.id);
    absenceHolderIdsByPosition.set(h.currentPositionId!, list);
  }
  const pendingAbsenceFirstApprover = submittedAbsenceRequests.filter((r) =>
    canDecideAbsenceRequestAsFirstApprover(session.user.employeeId, absenceHolderIdsByPosition.get(r.firstApproverPositionId!) ?? [])
  );

  // Competency Assessment P1 scoring (P2 dropped from the workflow — see
  // lib/competency.ts/competency-routing.ts) — same "I'm the evaluator, not
  // the evaluatee" shape as pendingOwnEvaluations above. Never had its own
  // persistent sidebar link for a pending task (only Training Admin's cycle
  // management does); surfaced here instead, linking straight to the
  // assessment's own scoring form.
  const pendingCompetencyAssessments = session.user.employeeId
    ? await prisma.competencyAssessment.findMany({
        where: { p1EmployeeId: session.user.employeeId, p1SubmittedAt: null },
        include: { employee: true, cycle: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Training effectiveness (D+30) tasks — "the Primary Position supervisor
  // completes it" (TRN-04/TRN-07) — scoped to this employee's own direct
  // reports (one query) rather than N one-off isDirectManagerOfEmployee
  // lookups, same pattern as the page's own candidate list.
  const directReportIds = session.user.employeeId ? await getDirectReportEmployeeIds(session.user.employeeId) : [];
  const pendingEffectivenessTasks = directReportIds.length
    ? await prisma.learningAssignment.findMany({
        where: {
          employeeId: { in: directReportIds },
          status: "COMPLETED",
          effectivenessRequiredSnapshot: true,
          effectivenessCompletedAt: null,
        },
        include: { employee: true, course: { select: { title: true } } },
        orderBy: { effectivenessDueDate: "asc" },
      })
    : [];

  return {
    hrManagerPositions,
    deptHeadDepartmentIds,
    isHrManager,
    isDeptHead,
    isNewAssetNeedApprover,
    isLossReviewApprover,
    isDisposalApprover,
    pendingOwnEvaluations,
    pendingGaNewAssetNeeds,
    pendingGaLossReviews,
    pendingGaDisposals,
    pendingRequests,
    pendingMovements,
    pendingDeptHeadRequests,
    pendingDeptHeadMovements,
    pendingDeptHeadRenewals,
    pendingDeptHeadOffboarding,
    pendingHrManagerRenewals,
    pendingHrManagerOffboarding,
    pendingDeptHeadTrainingRequests,
    pendingAbsenceHrAdmin,
    pendingAbsenceFirstApprover,
    pendingCompetencyAssessments,
    pendingEffectivenessTasks,
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
    p.pendingDeptHeadOffboarding.length +
    p.pendingHrManagerRenewals.length +
    p.pendingHrManagerOffboarding.length +
    p.pendingDeptHeadTrainingRequests.length +
    p.pendingAbsenceHrAdmin.length +
    p.pendingAbsenceFirstApprover.length +
    p.pendingCompetencyAssessments.length +
    p.pendingEffectivenessTasks.length
  );
}

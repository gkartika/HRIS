// Reads for the HR Admin applicant screens (pipeline table, Pelamar page).
import { prisma } from "@/lib/db";
import { candidateNextStep, isExcellent, type CandidateProgress } from "@/lib/recruitment-candidates";
import { isMovementRequestOpen } from "@/lib/movement";
import type { Prisma } from "@/generated/prisma/client";
import type { RecruitmentCandidateStatus } from "@/generated/prisma/enums";

// Stage filter chips, shared by the request's own pipeline and the Pelamar page.
export const STAGE_FILTERS: { key: string; label: string; statuses: RecruitmentCandidateStatus[] }[] = [
  { key: "tes", label: "Sedang tes", statuses: ["TESTING"] },
  { key: "review", label: "Menunggu review", statuses: ["AWAITING_REVIEW"] },
  { key: "lolos", label: "Lolos tes", statuses: ["TEST_PASSED"] },
  { key: "interview", label: "Interview", statuses: ["INTERVIEWING"] },
  { key: "offering", label: "Offering / perubahan posisi", statuses: ["OFFERING", "MOVEMENT"] },
  { key: "selesai", label: "Diterima", statuses: ["HIRED"] },
  { key: "gugur", label: "Tidak lolos / ditolak", statuses: ["TEST_FAILED", "REJECTED", "OFFER_DECLINED", "NOT_SELECTED"] },
];

export function statusesForStage(key: string | undefined): RecruitmentCandidateStatus[] | null {
  return STAGE_FILTERS.find((s) => s.key === key)?.statuses ?? null;
}

const candidateRowSelect = {
  id: true,
  requestId: true,
  source: true,
  fullName: true,
  email: true,
  mobileNumber: true,
  status: true,
  statusChangedAt: true,
  createdAt: true,
  closedAt: true,
  request: { select: { requestNumber: true, job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } },
  tests: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      status: true,
      passed: true,
      scorePercent: true,
      testType: { select: { name: true, form: true, excellentScore: true } },
      _count: { select: { reviewers: true } },
    },
  },
  assessment: { select: { status: true, totalScore: true } },
  interview: { select: { id: true, scheduledAt: true, mode: true, interviewers: { select: { submittedAt: true } } } },
  offer: { select: { sentAt: true, response: true } },
  movementRequest: { select: { id: true, requestNumber: true, status: true } },
} satisfies Prisma.RecruitmentCandidateSelect;

export type CandidateRow = Prisma.RecruitmentCandidateGetPayload<{ select: typeof candidateRowSelect }>;

export async function listCandidates(where: Prisma.RecruitmentCandidateWhereInput, take = 400): Promise<CandidateRow[]> {
  return prisma.recruitmentCandidate.findMany({
    relationLoadStrategy: "join",
    where,
    select: candidateRowSelect,
    orderBy: [{ statusChangedAt: "desc" }],
    take,
  });
}

export function progressOf(c: Omit<CandidateRow, "assessment">): CandidateProgress {
  const interviewers = c.interview?.interviewers ?? [];
  return {
    status: c.status,
    hasReviewer: c.tests.some((t) => t.testType.form === "ESSAY" && t.passed === null && t._count.reviewers > 0),
    hasInterview: !!c.interview,
    interviewersTotal: interviewers.length,
    interviewersSubmitted: interviewers.filter((i) => i.submittedAt).length,
    hasOffer: !!c.offer,
    offerSent: !!c.offer?.sentAt,
    offerAccepted: c.offer?.response === "ACCEPTED",
    hasMovement: !!c.movementRequest,
    movementOpen: !!c.movementRequest && isMovementRequestOpen(c.movementRequest.status),
  };
}

export interface WaitingGroup {
  requestId: string;
  requestNumber: string;
  label: string;
  count: number;
  oldest: Date;
  firstStep: string;
}

// Applicants who need the recruiter's next step, grouped per request (oldest wait first).
export function waitingApplicantGroups(rows: CandidateRow[]): WaitingGroup[] {
  const byRequest = new Map<string, WaitingGroup>();
  for (const c of rows) {
    const step = nextStepOf(c);
    if (!step.needsAction) continue;
    const entry = byRequest.get(c.requestId);
    if (entry) {
      entry.count += 1;
      if (c.statusChangedAt < entry.oldest) {
        entry.oldest = c.statusChangedAt;
        entry.firstStep = step.label;
      }
    } else {
      byRequest.set(c.requestId, {
        requestId: c.requestId,
        requestNumber: c.request.requestNumber,
        label: c.request.job?.jobTitle ?? c.request.department.unitName,
        count: 1,
        oldest: c.statusChangedAt,
        firstStep: step.label,
      });
    }
  }
  return [...byRequest.values()].sort((a, b) => a.oldest.getTime() - b.oldest.getTime());
}

// Whether this person was ever appointed reviewer or interviewer (shows "Tugas Rekrutmen").
export async function hasRecruitmentTasks(employeeId: string | null | undefined): Promise<boolean> {
  if (!employeeId) return false;
  const [review, interview] = await Promise.all([
    prisma.recruitmentTestReviewer.findFirst({ relationLoadStrategy: "join", where: { employeeId }, select: { id: true } }),
    prisma.recruitmentInterviewer.findFirst({ relationLoadStrategy: "join", where: { employeeId }, select: { id: true } }),
  ]);
  return !!review || !!interview;
}

export function nextStepOf(c: CandidateRow) {
  return candidateNextStep(progressOf(c));
}

// One-line summary of the tests, e.g. "Ketelitian 82 lulus, Studi Kasus menunggu".
export function testSummary(c: {
  tests: { status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED"; passed: boolean | null; scorePercent: number | null; testType: { name: string; excellentScore?: number | null } }[];
}): string {
  if (c.tests.length === 0) return "—";
  return c.tests
    .map((t) => {
      if (t.status !== "SUBMITTED") return `${t.testType.name}: ${t.status === "IN_PROGRESS" ? "berjalan" : "belum"}`;
      if (t.passed === null) return `${t.testType.name}: menunggu review`;
      const score = t.scorePercent !== null ? ` ${Math.round(t.scorePercent)}` : "";
      const star = t.passed && isExcellent(t.scorePercent, t.testType.excellentScore) ? " (istimewa)" : "";
      return `${t.testType.name}${score}: ${t.passed ? "lulus" : "tidak lulus"}${star}`;
    })
    .join(" · ");
}

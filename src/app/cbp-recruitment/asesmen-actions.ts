"use server";

import { prisma } from "@/lib/db";
import { getActiveSession } from "@/lib/require-session";
import { findCandidateByToken } from "@/lib/recruitment-service";
import {
  loadAssessmentQuestions,
  saveAssessmentAnswer,
  startAssessment,
  submitAssessment,
  type AssessmentQuestion,
} from "@/lib/recruitment-assessment-service";

// Who is taking the assessment: an external applicant holds a private link token; an internal applicant is
// an employee signed in to the app (the system then knows exactly which employee it is). Either way the
// server decides which applicant this is, never the browser, and the browser can never name a question of
// another assessment or an option of another question.
export type AssessmentAccess = { token: string } | { candidateId: string };
type Fail = { ok: false; error: string };
const DENIED: Fail = { ok: false, error: "Akses asesmen tidak valid." };

async function candidateIdOf(access: AssessmentAccess): Promise<string | null> {
  if ("token" in access) {
    const candidate = await findCandidateByToken(access.token);
    return candidate?.id ?? null;
  }
  const session = await getActiveSession();
  if (!session?.user.employeeId) return null;
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: access.candidateId },
    select: { id: true, employeeId: true, source: true },
  });
  return candidate && candidate.source === "INTERNAL" && candidate.employeeId === session.user.employeeId ? candidate.id : null;
}

export async function startAssessmentAction(access: AssessmentAccess): Promise<{ ok: true; deadlineAtMs: number; serverNowMs: number } | Fail> {
  const id = await candidateIdOf(access);
  return id ? startAssessment(id) : DENIED;
}

// The questions are fetched after Mulai, not shipped inside the page.
export async function loadAssessmentQuestionsAction(access: AssessmentAccess): Promise<{ ok: true; questions: AssessmentQuestion[] } | Fail> {
  const id = await candidateIdOf(access);
  return id ? loadAssessmentQuestions(id) : DENIED;
}

export async function saveAssessmentAnswerAction(access: AssessmentAccess, questionId: string, optionId: string): Promise<{ ok: true } | Fail> {
  const id = await candidateIdOf(access);
  return id ? saveAssessmentAnswer(id, questionId, optionId) : DENIED;
}

export async function submitAssessmentAction(access: AssessmentAccess): Promise<{ ok: true; timedOut: boolean } | Fail> {
  const id = await candidateIdOf(access);
  if (!id) return DENIED;
  const res = await submitAssessment(id);
  return res.ok ? { ok: true, timedOut: !!res.timedOut } : res;
}

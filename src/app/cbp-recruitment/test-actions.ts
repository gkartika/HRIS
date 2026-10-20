"use server";

import { prisma } from "@/lib/db";
import { getActiveSession } from "@/lib/require-session";
import {
  findCandidateByToken,
  saveCandidateAnswer,
  startCandidateTest,
  submitCandidateTest,
  type AnswerValue,
  type EngineResult,
} from "@/lib/recruitment-service";

// Who is taking the test: an external applicant holds a private link token; an internal
// applicant is an employee signed in to the app. Either way the server decides which
// applicant this is, never the browser.
export type TestAccess = { token: string } | { candidateId: string };

async function resolveCandidateId(access: TestAccess): Promise<string | null> {
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

const DENIED: EngineResult = { ok: false, error: "Akses tes tidak valid." };

export async function startTestAction(access: TestAccess, testId: string): Promise<EngineResult> {
  const candidateId = await resolveCandidateId(access);
  if (!candidateId) return DENIED;
  return startCandidateTest(candidateId, testId);
}

export async function saveAnswerAction(
  access: TestAccess,
  testId: string,
  questionId: string,
  value: AnswerValue
): Promise<EngineResult & { expired?: boolean }> {
  const candidateId = await resolveCandidateId(access);
  if (!candidateId) return DENIED;
  return saveCandidateAnswer(candidateId, testId, questionId, value);
}

export async function submitTestAction(access: TestAccess, testId: string, auto: boolean): Promise<EngineResult> {
  const candidateId = await resolveCandidateId(access);
  if (!candidateId) return DENIED;
  return submitCandidateTest(candidateId, testId, { auto });
}

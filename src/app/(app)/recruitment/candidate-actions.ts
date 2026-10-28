"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { canManageRecruitment } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import {
  createOffer,
  decideCandidate,
  recordOfferResponseByHr,
  rejectCandidate,
  reviewEssayTest,
  saveHrInterviewNotes,
  scheduleInterview,
  sendOfferLink,
  setTestReviewers,
  submitInterviewerForm,
  wibDateTime,
} from "@/lib/recruitment-flow";
import { generateAccessCode, fillTemplate, whatsappLink } from "@/lib/recruitment-candidates";
import { getRecruitmentSettings, purgeOldCandidates } from "@/lib/recruitment-service";
import { interviewMessageVars } from "@/lib/recruitment-flow";
import type { RecruitmentInterviewDecision, RecruitmentInterviewMode, RecruitmentOpenFor } from "@/generated/prisma/enums";

type Result = string | undefined;

async function hrAdminOr(): Promise<{ session: Awaited<ReturnType<typeof requireSession>> } | { error: string }> {
  const session = await requireSession();
  return canManageRecruitment(session) ? { session } : { error: t("common.forbidden") };
}

function refresh(requestId: string, candidateId?: string) {
  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment/applicants");
  if (candidateId) revalidatePath(`/recruitment/${requestId}/candidates/${candidateId}`);
}

async function requestIdOf(candidateId: string): Promise<string | null> {
  const c = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId }, select: { requestId: true } });
  return c?.requestId ?? null;
}

// ---------- the vacancy: who may apply, access code ----------

export async function setOpenForAction(requestId: string, openFor: RecruitmentOpenFor): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId }, select: { accessCode: true, requestNumber: true } });
  if (!request) return "Permintaan tidak ditemukan.";
  const needsCode = openFor === "EXTERNAL" || openFor === "BOTH";
  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: { openFor, ...(needsCode && !request.accessCode ? { accessCode: generateAccessCode() } : {}) },
  });
  await logAudit({ actorAccountId: auth.session.user.id, action: "UPDATE", datasetName: "RecruitmentRequest", recordId: requestId, reason: `Applicants may apply: ${openFor} (${request.requestNumber})` });
  refresh(requestId);
}

export async function regenerateAccessCodeAction(requestId: string): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  await prisma.recruitmentRequest.update({ where: { id: requestId }, data: { accessCode: generateAccessCode() } });
  await logAudit({ actorAccountId: auth.session.user.id, action: "UPDATE", datasetName: "RecruitmentRequest", recordId: requestId, reason: "New applicant access code" });
  refresh(requestId);
}

// Which tests this vacancy uses. null = go back to the job title's own tests. Applicants who already
// applied keep the tests they were given; the choice only applies to new applicants.
export async function setRequestTestsAction(requestId: string, testTypeIds: string[] | null): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId }, select: { requestNumber: true } });
  if (!request) return "Permintaan tidak ditemukan.";
  const ids = testTypeIds === null ? [] : [...new Set(testTypeIds)];
  if (ids.length) {
    const valid = await prisma.recruitmentTestType.count({ where: { id: { in: ids }, isGate: false, active: true } });
    if (valid !== ids.length) return "Ada tes yang tidak valid atau sudah nonaktif. Muat ulang halaman.";
  }
  await prisma.recruitmentRequest.update({ where: { id: requestId }, data: { testsCustomized: testTypeIds !== null, testTypeIds: ids } });
  await logAudit({
    actorAccountId: auth.session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: testTypeIds === null ? `Tests: back to the job title's tests (${request.requestNumber})` : `Tests chosen for this vacancy: ${ids.length} extra (${request.requestNumber})`,
  });
  refresh(requestId);
}

// ---------- essay review ----------

export async function setReviewersAction(candidateId: string, testId: string, employeeIds: string[]): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const res = await setTestReviewers(testId, employeeIds, auth.session.user.id);
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
  return res.ok ? undefined : res.error;
}

export async function reviewEssayAction(testId: string, _prev: Result, formData: FormData): Promise<Result> {
  const session = await requireSession();
  if (!session.user.employeeId) return t("common.forbidden");
  const decision = formData.get("decision") as string;
  if (decision !== "LULUS" && decision !== "TIDAK_LULUS") return "Pilih Lulus atau Tidak Lulus.";
  const res = await reviewEssayTest(testId, session.user.employeeId, decision === "LULUS", (formData.get("note") as string) ?? "");
  if (!res.ok) return res.error;
  revalidatePath("/recruitment/tasks");
  revalidatePath(`/recruitment/review/${testId}`);
  revalidatePath("/recruitment/applicants");
}

// ---------- interview ----------

export type ScheduleResult = { error?: string; whatsappUrl?: string; emailedCandidate?: boolean; emailedInterviewers?: number; applicantEmailOff?: boolean };

export async function scheduleInterviewAction(candidateId: string, _prev: ScheduleResult | undefined, formData: FormData): Promise<ScheduleResult> {
  const auth = await hrAdminOr();
  if ("error" in auth) return { error: auth.error };
  const scheduledAt = wibDateTime((formData.get("date") as string) ?? "", (formData.get("time") as string) ?? "");
  if (!scheduledAt) return { error: "Isi tanggal dan jam interview." };
  const mode = formData.get("mode") as RecruitmentInterviewMode;
  if (mode !== "OFFLINE" && mode !== "ONLINE") return { error: "Pilih bentuk interview." };
  const employeeIds = formData.getAll("interviewer").map(String).filter(Boolean);

  const res = await scheduleInterview({
    candidateId,
    scheduledAt,
    mode,
    location: (formData.get("location") as string) ?? "",
    employeeIds,
    accountId: auth.session.user.id,
  });
  if (!res.ok) return { error: res.error };

  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { requestId: true, fullName: true, mobileNumber: true, request: { select: { job: { select: { jobTitle: true } } } } },
  });
  let whatsappUrl: string | undefined;
  if (candidate) {
    refresh(candidate.requestId, candidateId);
    if (candidate.mobileNumber) {
      const settings = await getRecruitmentSettings();
      const vars = interviewMessageVars({
        fullName: candidate.fullName,
        positionTitle: candidate.request.job?.jobTitle ?? "posisi yang dilamar",
        scheduledAt,
        location: ((formData.get("location") as string) ?? "").trim(),
      });
      whatsappUrl = whatsappLink(candidate.mobileNumber, fillTemplate(settings.invitationWaTemplate, vars));
    }
  }
  return { whatsappUrl, emailedCandidate: res.emailedCandidate, emailedInterviewers: res.emailedInterviewers, applicantEmailOff: res.applicantEmailOff };
}

export async function submitInterviewFormAction(interviewerId: string, _prev: Result, formData: FormData): Promise<Result> {
  const session = await requireSession();
  if (!session.user.employeeId) return t("common.forbidden");
  const recommendation = formData.get("recommendation") as RecruitmentInterviewDecision;
  if (!["ACCEPTED", "CONSIDERED", "REJECTED"].includes(recommendation)) return "Pilih rekomendasi Anda.";
  const scores: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("score_")) scores[key.slice(6)] = Number(value);
  }
  const res = await submitInterviewerForm({
    interviewerId,
    employeeId: session.user.employeeId,
    scores,
    recommendation,
    note: (formData.get("note") as string) ?? "",
  });
  if (!res.ok) return res.error;
  revalidatePath("/recruitment/tasks");
  revalidatePath("/recruitment/applicants");
  const interviewer = await prisma.recruitmentInterviewer.findUnique({ where: { id: interviewerId }, select: { interviewId: true } });
  if (interviewer) revalidatePath(`/recruitment/interview/${interviewer.interviewId}`);
}

export async function saveHrNotesAction(candidateId: string, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const res = await saveHrInterviewNotes(candidateId, {
    attendance: (formData.get("attendance") as string) ?? "",
    documents: (formData.get("documents") as string) ?? "",
    process: (formData.get("process") as string) ?? "",
  });
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
  return res.ok ? undefined : res.error;
}

export async function decideCandidateAction(candidateId: string, decision: RecruitmentInterviewDecision, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const res = await decideCandidate({ candidateId, decision, note: (formData.get("note") as string) ?? "", accountId: auth.session.user.id });
  if (!res.ok) return res.error;
  await logAudit({ actorAccountId: auth.session.user.id, action: decision === "REJECTED" ? "REJECT" : "APPROVE", datasetName: "RecruitmentCandidate", recordId: candidateId, reason: `Final interview decision: ${decision}` });
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
}

export async function rejectCandidateAction(candidateId: string, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const res = await rejectCandidate(candidateId, (formData.get("reason") as string) ?? "");
  if (!res.ok) return res.error;
  await logAudit({ actorAccountId: auth.session.user.id, action: "REJECT", datasetName: "RecruitmentCandidate", recordId: candidateId, reason: "Applicant ended by HR Admin" });
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
}

// ---------- offering letter ----------

export async function uploadOfferAction(candidateId: string, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Pilih berkas offering letter (PDF).";
  const res = await createOffer({
    candidateId,
    file: { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) },
    signature: (formData.get("signature") as string) ?? "",
    accountId: auth.session.user.id,
  });
  if (!res.ok) return res.error;
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
}

export type SendOfferResult = { error?: string; url?: string; emailed?: boolean; applicantEmailOff?: boolean; whatsappUrl?: string };

export async function sendOfferAction(candidateId: string): Promise<SendOfferResult> {
  const auth = await hrAdminOr();
  if ("error" in auth) return { error: auth.error };
  const res = await sendOfferLink(candidateId);
  if (!res.ok) return { error: res.error };
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
  const whatsappUrl = res.mobileNumber
    ? whatsappLink(res.mobileNumber, `Halo ${res.candidateName}, ini HR PT CBP. Surat penawaran kerja Anda ada di tautan ini: ${res.url}`)
    : undefined;
  return { url: res.url, emailed: res.emailed, applicantEmailOff: res.applicantEmailOff, whatsappUrl };
}

export async function recordOfferResponseAction(candidateId: string, response: "ACCEPTED" | "DECLINED"): Promise<Result> {
  const auth = await hrAdminOr();
  if ("error" in auth) return auth.error;
  const res = await recordOfferResponseByHr(candidateId, response);
  if (!res.ok) return res.error;
  await logAudit({ actorAccountId: auth.session.user.id, action: "UPDATE", datasetName: "RecruitmentOffer", recordId: candidateId, reason: `Offer answer recorded by HR Admin: ${response}` });
  const requestId = await requestIdOf(candidateId);
  if (requestId) refresh(requestId, candidateId);
}

// ---------- clean-up ----------

export async function purgeOldCandidatesAction(): Promise<{ error?: string; deleted?: number }> {
  const auth = await hrAdminOr();
  if ("error" in auth) return { error: auth.error };
  const deleted = await purgeOldCandidates(auth.session.user.id);
  revalidatePath("/recruitment/applicants");
  revalidatePath("/recruitment/settings");
  return { deleted };
}

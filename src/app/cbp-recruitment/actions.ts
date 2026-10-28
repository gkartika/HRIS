"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  accessCodeMatches,
  isValidEmail,
  mobileProblem,
  normalizeEmail,
  normalizeMobile,
  reapplyBlock,
} from "@/lib/recruitment-candidates";
import { readApplicantUpload } from "@/lib/applicant-uploads";
import { createCandidate, getRecruitmentSettings, loadPlanContext, readinessProblems } from "@/lib/recruitment-service";
import { respondToOffer, trySendToApplicant } from "@/lib/recruitment-flow";
import { appBaseUrl } from "@/lib/mailer";

// Public "Lamar" form: no sign-in. The request's access code is what keeps strangers
// from filling the applicant list; the answer for a wrong code or a closed vacancy is
// deliberately the same wording.
export async function applyExternalAction(
  requestId: string,
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const code = ((formData.get("accessCode") as string) ?? "").trim();
  const fullName = ((formData.get("fullName") as string) ?? "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const mobile = ((formData.get("mobileNumber") as string) ?? "").trim();

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id: requestId },
    include: { _count: { select: { fulfillments: true } } },
  });
  if (!request || (request.openFor !== "EXTERNAL" && request.openFor !== "BOTH") || !accessCodeMatches(request.accessCode, code)) {
    return "Kode akses tidak cocok atau lowongan sudah ditutup. Periksa kode di iklan lowongan.";
  }

  if (fullName.length < 3 || fullName.length > 120) return "Isi nama lengkap Anda.";
  if (!isValidEmail(email)) return "Alamat email tidak valid.";
  const mobileIssue = mobileProblem(mobile);
  if (mobileIssue) return mobileIssue;

  // The newest CV is required; one supporting document is optional.
  const cvRead = await readApplicantUpload(formData.get("cv"), "CV terbaru", true);
  if ("error" in cvRead) return cvRead.error;
  const supportingRead = await readApplicantUpload(formData.get("supporting"), "dokumen pendukung", false);
  if ("error" in supportingRead) return supportingRead.error;
  const cv = cvRead.upload;
  const supporting = supportingRead.upload;

  const [ctx, settings, prior] = await Promise.all([
    loadPlanContext(),
    getRecruitmentSettings(),
    prisma.recruitmentCandidate.findMany({
      where: { email },
      select: { requestId: true, status: true, closedAt: true },
    }),
  ]);
  if (request.heldAt) return "Lowongan ini sedang dihentikan sementara. Silakan coba lagi nanti.";
  if (readinessProblems(ctx, request, request._count.fulfillments).length > 0 || !request.jobId) {
    return "Lowongan ini belum bisa menerima pelamar. Silakan coba lagi nanti.";
  }
  const block = reapplyBlock(prior, request.id, new Date(), settings.retakeDays);
  if (block.blocked) return block.message;

  let created: Awaited<ReturnType<typeof createCandidate>>;
  try {
    created = await createCandidate({
      requestId: request.id,
      jobId: request.jobId,
      testsCustomized: request.testsCustomized,
      testTypeIds: request.testTypeIds,
      source: "EXTERNAL",
      fullName,
      email,
      mobileNumber: normalizeMobile(mobile),
      cv,
      supporting,
    });
  } catch (error) {
    // Say so on the form (their data stays filled in) instead of an error page.
    console.error("applyExternalAction: createCandidate failed", error);
    return "Lamaran belum bisa dikirim karena gangguan koneksi. Silakan tekan Kirim sekali lagi. Data Anda tidak hilang.";
  }
  await logAudit({
    actorAccountId: null,
    action: "CREATE",
    datasetName: "RecruitmentCandidate",
    recordId: created.id,
    reason: `External applicant applied for ${request.requestNumber}`,
  });
  // A copy of the private test link by email, so a closed tab or a new phone does not lock the applicant out. Sent only
  // while applicant email is switched on (see applicant-email.ts); the redirect below works either way.
  const testUrl = `${appBaseUrl()}/cbp-recruitment/tes/${created.rawToken}`;
  await trySendToApplicant(email, "Tautan tes lamaran PT CBP", `Yth. ${fullName},

Terima kasih sudah melamar di PT Cahaya Bukit Perunggu. Simpan email ini: tautan di bawah adalah satu-satunya cara masuk ke tes Anda dan hanya untuk Anda.`, { url: testUrl, label: "Buka tes" });
  redirect(`/cbp-recruitment/tes/${created.rawToken}`);
}

export async function respondOfferAction(
  token: string,
  response: "ACCEPTED" | "DECLINED",
  signature: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  return respondToOffer(token, response, signature);
}

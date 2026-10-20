"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  accessCodeMatches,
  isValidEmail,
  isValidMobile,
  normalizeEmail,
  normalizeMobile,
  reapplyBlock,
  validateCvFile,
} from "@/lib/recruitment-candidates";
import { createCandidate, getRecruitmentSettings, loadPlanContext, readinessProblems } from "@/lib/recruitment-service";
import { respondToOffer } from "@/lib/recruitment-flow";

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
  const cvEntry = formData.get("cv");

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id: requestId },
    include: { _count: { select: { fulfillments: true } } },
  });
  if (!request || (request.openFor !== "EXTERNAL" && request.openFor !== "BOTH") || !accessCodeMatches(request.accessCode, code)) {
    return "Kode akses tidak cocok atau lowongan sudah ditutup. Periksa kode di iklan lowongan.";
  }

  if (fullName.length < 3 || fullName.length > 120) return "Isi nama lengkap Anda.";
  if (!isValidEmail(email)) return "Alamat email tidak valid.";
  if (!isValidMobile(mobile)) return "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";

  let cv: { name: string; type: string; data: Buffer } | null = null;
  if (cvEntry instanceof File && cvEntry.size > 0) {
    const cvError = validateCvFile({ name: cvEntry.name, size: cvEntry.size, type: cvEntry.type });
    if (cvError) return cvError;
    cv = { name: cvEntry.name, type: cvEntry.type, data: Buffer.from(await cvEntry.arrayBuffer()) };
  }

  const [ctx, settings, prior] = await Promise.all([
    loadPlanContext(),
    getRecruitmentSettings(),
    prisma.recruitmentCandidate.findMany({
      where: { email },
      select: { requestId: true, status: true, closedAt: true },
    }),
  ]);
  if (readinessProblems(ctx, request, request._count.fulfillments).length > 0 || !request.jobId) {
    return "Lowongan ini belum bisa menerima pelamar. Silakan coba lagi nanti.";
  }
  const block = reapplyBlock(prior, request.id, new Date(), settings.retakeDays);
  if (block.blocked) return block.message;

  const created = await createCandidate({
    requestId: request.id,
    jobId: request.jobId,
    testsCustomized: request.testsCustomized,
    testTypeIds: request.testTypeIds,
    source: "EXTERNAL",
    fullName,
    email,
    mobileNumber: normalizeMobile(mobile),
    cv,
  });
  await logAudit({
    actorAccountId: null,
    action: "CREATE",
    datasetName: "RecruitmentCandidate",
    recordId: created.id,
    reason: `External applicant applied for ${request.requestNumber}`,
  });
  redirect(`/cbp-recruitment/tes/${created.rawToken}`);
}

export async function respondOfferAction(
  token: string,
  response: "ACCEPTED" | "DECLINED",
  signature: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  return respondToOffer(token, response, signature);
}

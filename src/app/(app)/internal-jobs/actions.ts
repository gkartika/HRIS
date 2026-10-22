"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { isValidEmail, mobileProblem, normalizeEmail, normalizeMobile, reapplyBlock } from "@/lib/recruitment-candidates";
import { readApplicantUpload } from "@/lib/applicant-uploads";
import { createCandidate, getRecruitmentSettings, loadPlanContext, readinessProblems } from "@/lib/recruitment-service";

// An employee applies for an internal vacancy with their own account. Their line manager
// is not told now; the manager hears only after the new position is official.
export async function applyInternalAction(requestId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return "Akun Anda tidak terhubung ke data karyawan.";

  const [employee, request, ctx, settings] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullLegalName: true, activeFlag: true },
    }),
    prisma.recruitmentRequest.findUnique({ where: { id: requestId }, include: { _count: { select: { fulfillments: true } } } }),
    loadPlanContext(),
    getRecruitmentSettings(),
  ]);
  if (!employee?.activeFlag) return "Data karyawan Anda tidak aktif.";
  if (!request || !request.jobId || (request.openFor !== "INTERNAL" && request.openFor !== "BOTH")) return "Lowongan ini sudah ditutup atau tidak dibuka untuk karyawan.";
  if (readinessProblems(ctx, request, request._count.fulfillments).length > 0) return "Lowongan ini belum bisa menerima pelamar.";

  // Email and WhatsApp are asked on the form (prefilled from the profile) and kept for this application only.
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  if (!isValidEmail(email)) return "Alamat email tidak valid.";
  const mobile = ((formData.get("mobileNumber") as string) ?? "").trim();
  const mobileIssue = mobileProblem(mobile);
  if (mobileIssue) return mobileIssue;
  const cvRead = await readApplicantUpload(formData.get("cv"), "CV terbaru", true);
  if ("error" in cvRead) return cvRead.error;
  const supportingRead = await readApplicantUpload(formData.get("supporting"), "dokumen pendukung", false);
  if ("error" in supportingRead) return supportingRead.error;

  const prior = await prisma.recruitmentCandidate.findMany({
    where: { OR: [{ employeeId }, { email }] },
    select: { requestId: true, status: true, closedAt: true },
  });
  const block = reapplyBlock(prior, request.id, new Date(), settings.retakeDays);
  if (block.blocked) return block.message;

  const created = await createCandidate({
    requestId: request.id,
    jobId: request.jobId,
    testsCustomized: request.testsCustomized,
    testTypeIds: request.testTypeIds,
    source: "INTERNAL",
    employeeId,
    fullName: employee.fullLegalName,
    email,
    mobileNumber: normalizeMobile(mobile),
    cv: cvRead.upload,
    supporting: supportingRead.upload,
  });
  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "RecruitmentCandidate",
    recordId: created.id,
    reason: `Internal applicant applied for ${request.requestNumber}`,
  });
  revalidatePath("/internal-jobs");
  redirect(`/internal-jobs/tes/${created.id}`);
}

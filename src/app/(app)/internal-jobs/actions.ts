"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { normalizeEmail, normalizeMobile, reapplyBlock } from "@/lib/recruitment-candidates";
import { createCandidate, getRecruitmentSettings, loadPlanContext, readinessProblems } from "@/lib/recruitment-service";

// An employee applies for an internal vacancy with their own account. Their line manager
// is not told now; the manager hears only after the new position is official.
export async function applyInternalAction(requestId: string): Promise<string | undefined> {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return "Akun Anda tidak terhubung ke data karyawan.";

  const [employee, request, ctx, settings] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullLegalName: true, mobileNumber: true, personalEmail: true, activeFlag: true, account: { select: { usernameOrEmail: true } } },
    }),
    prisma.recruitmentRequest.findUnique({ where: { id: requestId }, include: { _count: { select: { fulfillments: true } } } }),
    loadPlanContext(),
    getRecruitmentSettings(),
  ]);
  if (!employee?.activeFlag) return "Data karyawan Anda tidak aktif.";
  if (!request || !request.jobId || (request.openFor !== "INTERNAL" && request.openFor !== "BOTH")) return "Lowongan ini sudah ditutup atau tidak dibuka untuk karyawan.";
  if (readinessProblems(ctx, request, request._count.fulfillments).length > 0) return "Lowongan ini belum bisa menerima pelamar.";

  const login = employee.account?.usernameOrEmail;
  const email = normalizeEmail(employee.personalEmail ?? (login?.includes("@") ? login : ""));
  if (!email) return "Email Anda belum tercatat. Minta Admin SDM mengisi Email Pribadi Anda.";

  const prior = await prisma.recruitmentCandidate.findMany({
    where: { OR: [{ employeeId }, { email }] },
    select: { requestId: true, status: true, closedAt: true },
  });
  const block = reapplyBlock(prior, request.id, new Date(), settings.retakeDays);
  if (block.blocked) return block.message;

  const created = await createCandidate({
    requestId: request.id,
    jobId: request.jobId,
    source: "INTERNAL",
    employeeId,
    fullName: employee.fullLegalName,
    email,
    mobileNumber: employee.mobileNumber ? normalizeMobile(employee.mobileNumber) : null,
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

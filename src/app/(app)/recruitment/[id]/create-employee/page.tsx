import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canCreateEmployeeFromRequest } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeFulfillmentCounts, canRequestAcceptFulfillment } from "@/lib/recruitment";
import { CreateEmployeeFromRequestForm } from "./create-employee-form";
import { peekNextEmployeeNumber } from "@/lib/employee-number-allocate";
import { findVacantPositionsInDepartment } from "@/lib/recruitment-seats";
import { validateCandidateForHire } from "@/lib/recruitment-flow";

export default async function CreateEmployeeFromRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidateId?: string }>;
}) {
  const { id } = await params;
  const { candidateId } = await searchParams;
  const session = await requireSession();
  if (!canCreateEmployeeFromRequest(session)) {
    return <AccessDenied />;
  }

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id },
    include: { department: true, job: true, fulfillments: true },
  });
  if (!request) notFound();

  const counts = computeFulfillmentCounts(request.requestedHeadcount, request.fulfillments.length);
  if (!canRequestAcceptFulfillment(request.status) || counts.isFull) {
    return (
      <p className="text-sm text-rose-600">
        {counts.isFull ? t("recruitment.requestFullyFilled") : t("recruitment.requestNotFulfillable")}
      </p>
    );
  }
  // Jabatan is set by the HR Manager at Approve time (no longer picked by
  // the requester) — canRequestAcceptFulfillment already guarantees this
  // request passed through Approved, so jobId should always be set here.
  if (!request.jobId || !request.job) {
    return <p className="text-sm text-rose-600">{t("recruitment.jobNotSetOnApproval")}</p>;
  }

  // Coming from an applicant who accepted the offering letter: fill in what we already know.
  let candidate: { id: string; fullName: string; mobileNumber: string | null } | null = null;
  if (candidateId) {
    const problem = await validateCandidateForHire(candidateId, request.id);
    if (problem) return <p className="text-sm text-rose-600">{problem}</p>;
    candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId }, select: { id: true, fullName: true, mobileNumber: true } });
  }

  const [candidatePositions, educationLevels, ptkpStatuses, nextEmployeeNumber] = await Promise.all([
    // Vacant seats of this job anywhere under the request's department
    // (Section/Group/Team included), not only seats placed directly on it.
    findVacantPositionsInDepartment(request.departmentId, request.jobId),
    prisma.educationLevel.findMany({
      where: { activeFlag: true },
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    }),
    prisma.ptkpStatus.findMany({
      where: { activeFlag: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
    peekNextEmployeeNumber(),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("recruitment.createEmployeeFromRequest")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {request.requestNumber} — {request.job.jobTitle} — {request.department.unitName} —{" "}
        {t("recruitment.filledOf", { filled: counts.filledCount, total: request.requestedHeadcount })}
      </p>
      <div className="mt-4 max-w-2xl">
        <CreateEmployeeFromRequestForm
          requestId={request.id}
          candidatePositions={candidatePositions}
          educationLevels={educationLevels}
          ptkpStatuses={ptkpStatuses}
          nextEmployeeNumber={nextEmployeeNumber}
          candidate={candidate}
        />
      </div>
    </div>
  );
}

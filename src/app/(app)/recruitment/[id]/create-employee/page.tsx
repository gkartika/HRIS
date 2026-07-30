import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canCreateEmployeeFromRequest } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeFulfillmentCounts, canRequestAcceptFulfillment } from "@/lib/recruitment";
import { CreateEmployeeFromRequestForm } from "./create-employee-form";

export default async function CreateEmployeeFromRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!canCreateEmployeeFromRequest(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
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

  const [candidatePositions, educationLevels, ptkpStatuses] = await Promise.all([
    prisma.position.findMany({
      where: { jobId: request.jobId, orgUnitId: request.departmentId },
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
    prisma.educationLevel.findMany({
      where: { activeFlag: true },
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    }),
    prisma.ptkpStatus.findMany({
      where: { activeFlag: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
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
        />
      </div>
    </div>
  );
}

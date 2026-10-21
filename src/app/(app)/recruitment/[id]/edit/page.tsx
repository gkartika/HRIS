import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { canResubmitRequestStatus } from "@/lib/recruitment";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CreateRequestForm } from "../../new/create-request-form";

// A returned request (Kembalikan) is corrected here and sent again. The page
// checks access itself: the requester, or Admin SDM on their behalf.
export default async function EditReturnedRecruitmentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const request = await prisma.recruitmentRequest.findUnique({ where: { id } });
  if (!request) notFound();

  const isRequester = !!session.user.employeeId && session.user.employeeId === request.requesterEmployeeId;
  if (!isRequester && !isHrAdmin(session)) return <AccessDenied />;

  if (!canResubmitRequestStatus(request.status)) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-rose-600">Hanya permintaan yang dikembalikan yang dapat diubah dan diajukan ulang.</p>
        <Link href={`/recruitment/${request.id}`} className="text-sm text-indigo-600 hover:underline">
          Kembali ke detail permintaan
        </Link>
      </div>
    );
  }

  const [departments] = await Promise.all([
    prisma.orgUnit.findMany({
      where: { OR: [{ activeFlag: true, unitType: "DEPARTMENT" }, { id: request.departmentId }] },
      orderBy: { unitName: "asc" },
    }),
  ]);

  const returnedByHrManager = !!request.approvedByAccountId;
  const returnNote = returnedByHrManager ? request.decisionNote : request.deptHeadDecisionNote;
  const stage = returnedByHrManager ? t("recruitment.resubmitStageHrManager") : t("recruitment.resubmitStageDeptHead");

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Rekrutmen", href: "/recruitment" },
          { label: request.requestNumber, href: `/recruitment/${request.id}` },
          { label: "Ubah & Ajukan Ulang" },
        ]}
      />
      <h1 className="text-lg font-medium text-slate-900">
        {t("recruitment.resubmitTitle")} <span className="font-mono">{request.requestNumber}</span>
      </h1>
      <p className="mt-1 text-sm text-slate-500">{t("recruitment.resubmitHint")}</p>

      <div className="mt-4 max-w-3xl space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800">
            {t("recruitment.returnedNote")} ({stage})
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{returnNote ?? "—"}</p>
          <p className="mt-2 text-xs text-amber-700">
            {t("recruitment.resubmitGoesTo", { stage })} Jika department diganti, permintaan dimulai lagi dari Kepala
            Departemen/Manajer department yang baru.
          </p>
        </div>
        <CreateRequestForm
          departments={departments}
          employees={[]}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdmin(session)}
          resubmitRequestId={request.id}
          initial={{
            requestDate: request.requestDate.toISOString().slice(0, 10),
            reasonCode: request.reasonCode,
            departmentId: request.departmentId,
            requestedJobText: request.requestedJobText ?? "",
            shiftCode: request.shiftCode,
            requestedHeadcount: request.requestedHeadcount,
            jobDescriptionSnapshot: request.jobDescriptionSnapshot,
            educationRequirementCode: request.educationRequirementCode,
            workExperienceBand: request.workExperienceBand,
            ageBand: request.ageBand,
            genderRequirement: request.genderRequirement,
            specialCriteria: request.specialCriteria,
          }}
        />
      </div>
    </div>
  );
}

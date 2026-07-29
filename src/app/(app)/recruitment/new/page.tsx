import { requireSession } from "@/lib/require-session";
import { canSubmitRecruitmentRequest, isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateRequestForm } from "./create-request-form";

export default async function NewRecruitmentRequestPage() {
  const session = await requireSession();
  if (!canSubmitRecruitmentRequest(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [departments, jobs, positions, employees] = await Promise.all([
    prisma.orgUnit.findMany({ where: { activeFlag: true }, orderBy: { unitName: "asc" } }),
    prisma.job.findMany({ orderBy: { jobTitle: "asc" } }),
    prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } }),
    isHrAdmin(session)
      ? prisma.employee.findMany({ where: { activeFlag: true }, orderBy: { fullLegalName: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("recruitment.formTitle")}</h1>
      <div className="mt-4 max-w-3xl">
        <CreateRequestForm
          departments={departments}
          jobs={jobs}
          positions={positions}
          employees={employees}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdmin(session)}
        />
      </div>
    </div>
  );
}

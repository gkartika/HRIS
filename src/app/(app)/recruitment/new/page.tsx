import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canSubmitRecruitmentRequest, isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateRequestForm } from "./create-request-form";

export default async function NewRecruitmentRequestPage() {
  const session = await requireSession();
  if (!canSubmitRecruitmentRequest(session)) {
    return <AccessDenied />;
  }

  const [departments, jobs, employees] = await Promise.all([
    // DEPARTMENT-only — the request names a Department; at fulfillment any
    // vacant seat in it or below it (Section/Group/Team) can be used.
    prisma.orgUnit.findMany({ where: { activeFlag: true, unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.job.findMany({ orderBy: { jobTitle: "asc" } }),
    isHrAdmin(session)
      ? prisma.employee.findMany({ where: { activeFlag: true }, orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("recruitment.formTitle")}</h1>
      <div className="mt-4 max-w-3xl">
        <CreateRequestForm
          departments={departments}
          jobs={jobs}
          employees={employees}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdmin(session)}
        />
      </div>
    </div>
  );
}

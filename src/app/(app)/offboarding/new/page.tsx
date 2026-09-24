import { requireSession } from "@/lib/require-session";
import { canStartOffboarding } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ReportResignationForm } from "./report-resignation-form";

// HR Admin alone opens an offboarding case, for any employee.
export default async function ReportResignationPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId: preselectedEmployeeId } = await searchParams;
  const session = await requireSession();

  if (!canStartOffboarding(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const employees = await prisma.employee.findMany({
    where: { activeFlag: true },
    include: { currentPosition: { include: { job: true, orgUnit: true } } },
    orderBy: { fullLegalName: "asc" },
  });

  const reasons = await prisma.offboardingReasonOption.findMany({
    where: { activeFlag: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, label: true },
  });

  const defaultEmployeeId =
    preselectedEmployeeId && employees.some((e) => e.id === preselectedEmployeeId) ? preselectedEmployeeId : "";

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("offboarding.reportTitle")}</h1>
      <div className="mt-4 max-w-2xl">
        <ReportResignationForm employees={employees} reasons={reasons} defaultEmployeeId={defaultEmployeeId} />
      </div>
    </div>
  );
}

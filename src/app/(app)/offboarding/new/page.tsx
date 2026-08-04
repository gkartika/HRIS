import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ReportResignationForm } from "./report-resignation-form";

// LIF-06: eligible subjects are HR Admin's full roster, or (for a plain
// manager) only their own direct reports — one level via
// Position.reportsToPositionId, same relation /team already reads, not the
// broader department-wide Level-3 scope Movement/Contract use, since
// reporting a resignation is specifically "manager input" about someone who
// reports to you.
export default async function ReportResignationPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId: preselectedEmployeeId } = await searchParams;
  const session = await requireSession();

  const isHrAdminUser = isHrAdmin(session);
  let eligibleEmployeeIds: string[] | null = null;

  if (!isHrAdminUser) {
    if (!session.user.employeeId) {
      return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
    }
    const me = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { currentPositionId: true },
    });
    const directReportPositions = me?.currentPositionId
      ? await prisma.position.findMany({
          where: { reportsToPositionId: me.currentPositionId },
          select: { currentHolders: { select: { id: true } } },
        })
      : [];
    eligibleEmployeeIds = directReportPositions.flatMap((p) => p.currentHolders.map((h) => h.id));
    if (eligibleEmployeeIds.length === 0) {
      return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
    }
  }

  const employees = await prisma.employee.findMany({
    where: eligibleEmployeeIds ? { id: { in: eligibleEmployeeIds } } : {},
    include: { currentPosition: { include: { job: true, orgUnit: true } } },
    orderBy: { fullLegalName: "asc" },
  });

  const defaultEmployeeId =
    preselectedEmployeeId && employees.some((e) => e.id === preselectedEmployeeId) ? preselectedEmployeeId : "";

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("offboarding.reportTitle")}</h1>
      <div className="mt-4 max-w-2xl">
        <ReportResignationForm employees={employees} defaultEmployeeId={defaultEmployeeId} />
      </div>
    </div>
  );
}

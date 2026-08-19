import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { remainingEntitlementDays, absenceDayCount } from "@/lib/absence";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitAbsenceForm } from "./submit-absence-form";

export default async function NewAbsenceRequestPage() {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);

  if (!isHrAdminUser && !session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const employees = isHrAdminUser
    ? await prisma.employee.findMany({
        where: { activeFlag: true },
        orderBy: { fullLegalName: "asc" },
        select: { id: true, employeeNumber: true, fullLegalName: true },
      })
    : [];

  let remainingCuti: number | null = null;
  if (!isHrAdminUser && session.user.employeeId) {
    const [config, approvedThisYear] = await Promise.all([
      prisma.absenceEntitlementConfig.findUnique({ where: { absenceType: "CUTI" } }),
      prisma.absenceRequest.findMany({
        where: {
          employeeId: session.user.employeeId,
          absenceType: "CUTI",
          status: "APPROVED",
          startDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);
    if (config) {
      const usedDays = approvedThisYear.reduce((sum, r) => sum + absenceDayCount(r.startDate, r.endDate), 0);
      remainingCuti = remainingEntitlementDays(config.annualDays, usedDays);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("absence.newRequest")}</h1>
      {remainingCuti !== null && (
        <p className="mt-1 text-sm text-slate-500">{t("absence.remainingEntitlement", { days: remainingCuti })}</p>
      )}
      <div className="mt-4">
        <SubmitAbsenceForm
          employeeId={isHrAdminUser ? undefined : session.user.employeeId!}
          employees={
            isHrAdminUser
              ? employees.map((e) => ({ id: e.id, label: `${e.employeeNumber} — ${e.fullLegalName}` }))
              : undefined
          }
        />
      </div>
    </div>
  );
}

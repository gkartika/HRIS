import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { resolveAnnualQuota, usedDaysThisYear } from "@/lib/absence-quota";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitAbsenceForm } from "./submit-absence-form";

export default async function NewAbsenceRequestPage() {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);

  if (!isHrAdminUser && !session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [employees, absenceTypes] = await Promise.all([
    isHrAdminUser
      ? prisma.employee.findMany({
          where: { activeFlag: true },
          orderBy: { fullLegalName: "asc" },
          select: { id: true, employeeNumber: true, fullLegalName: true },
        })
      : Promise.resolve([]),
    prisma.absenceTypeConfig.findMany({
      where: { activeFlag: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true },
    }),
  ]);

  // Quota context is only meaningful for the person submitting their own
  // request — HR Admin picks an arbitrary employee from a dropdown, and
  // showing "your" quota wouldn't make sense until one is chosen, which is
  // out of scope here (the request detail page is the real decision-time
  // quota surface, see absences/[id]/page.tsx).
  let quotaByType: { code: string; quota: number | null; usedDays: number }[] = [];
  if (!isHrAdminUser && session.user.employeeId) {
    const employeeId = session.user.employeeId;
    quotaByType = await Promise.all(
      absenceTypes.map(async (tp) => {
        const [quota, usedDays] = await Promise.all([
          resolveAnnualQuota(employeeId, tp.code),
          usedDaysThisYear(employeeId, tp.code),
        ]);
        return { code: tp.code, quota, usedDays };
      })
    );
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("absence.newRequest")}</h1>
      <div className="mt-4">
        <SubmitAbsenceForm
          employeeId={isHrAdminUser ? undefined : session.user.employeeId!}
          employees={
            isHrAdminUser
              ? employees.map((e) => ({ id: e.id, label: `${e.employeeNumber} — ${e.fullLegalName}` }))
              : undefined
          }
          absenceTypes={absenceTypes}
          quotaByType={quotaByType}
        />
      </div>
    </div>
  );
}

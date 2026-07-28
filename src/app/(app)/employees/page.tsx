import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canListEmployees, canCreateEmployee, isHrAdmin, projectEmployee } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { isEmployeeProfileIncomplete } from "@/lib/employee-completeness";

export default async function EmployeesPage() {
  const session = await requireSession();
  if (!canListEmployees(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const employees = await prisma.employee.findMany({
    orderBy: { employeeNumber: "asc" },
    include: { currentPosition: { include: { job: true, orgUnit: true } } },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "VIEW",
    datasetName: "Employee",
    reason: "Viewed employee list",
  });

  const rows = employees.map((e) => projectEmployee(e, session));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">{t("employee.listTitle")}</h1>
        {canCreateEmployee(session) && (
          <Link
            href="/employees/new"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <UserPlus size={14} />
            {t("employee.addEmployee")}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{t("employee.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("employee.employeeNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.currentPosition")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.employmentStatus")}</th>
                {isHrAdmin(session) && <th className="px-4 py-3 font-medium">Kelengkapan Data</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, idx) => {
                const row = rows[idx];
                return (
                  <tr key={employee.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/employees/${employee.id}`}
                        className="font-mono text-xs text-indigo-600 hover:underline"
                      >
                        {row.employeeNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.preferredName ?? row.fullLegalName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {employee.currentPosition
                        ? `${employee.currentPosition.job.jobTitle} — ${employee.currentPosition.orgUnit.unitName}`
                        : t("employee.noPosition")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.employmentStatus ? t(`employmentStatus.${row.employmentStatus}`) : "—"}
                    </td>
                    {isHrAdmin(session) && (
                      <td className="px-4 py-3">
                        {isEmployeeProfileIncomplete(employee) ? (
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            Belum Lengkap
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            Lengkap
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

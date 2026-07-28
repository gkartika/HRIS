import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, canListEmployees, projectEmployee } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";

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

import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { formatDateMedium } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// ACC-17/15-In-App-Review "Shared Evaluation workflow": "P1/P2 see only My
// Evaluations and their own scoring slot" — any employee-linked account may
// be assigned as an evaluator regardless of role, so this page has no
// further gate beyond being logged in with an Employee record.
export default async function MyEvaluationsPage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <AccessDenied />;
  }

  const evaluations = await prisma.evaluation.findMany({
    where: {
      status: { not: "DRAFT" },
      OR: [{ p1EmployeeId: employeeId }, { p2EmployeeId: employeeId }],
    },
    include: { employee: true },
    orderBy: { releasedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("evaluation.myEvaluationsTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("evaluation.myEvaluationsSubtitle")}</p>

      {evaluations.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t("evaluation.emptyState")}</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("evaluation.evaluationNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("evaluation.purpose")}</th>
                <th className="px-4 py-3 font-medium">{t("evaluation.role")}</th>
                <th className="px-4 py-3 font-medium">{t("evaluation.dueDate")}</th>
                <th className="px-4 py-3 font-medium">{t("evaluation.status")}</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/evaluations/${e.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {e.evaluationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.employee.fullLegalName}</td>
                  <td className="px-4 py-3 text-slate-600">{t(`evaluationPurpose.${e.purpose}`)}</td>
                  <td className="px-4 py-3 text-slate-600">{e.p1EmployeeId === employeeId ? "P1" : "P2"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateMedium(e.evaluationDueDate)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {t(`evaluationStatus.${e.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

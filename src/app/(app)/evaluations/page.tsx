import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import type { Prisma, EvaluationStatus, EvaluationPurpose } from "@/generated/prisma/client";

const STATUSES: EvaluationStatus[] = ["DRAFT", "RELEASED", "COMPLETED", "RETURNED", "CANCELLED", "VOIDED"];
const PURPOSES: EvaluationPurpose[] = ["CONTRACT_RENEWAL", "PROMOTION", "MUTATION", "DEMOTION", "MANUAL_HR"];

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(date));
}

// WF-19/ACC-17: this operational list is HR-Admin-only — P1/P2 reach their
// own assigned evaluations via /my-evaluations, and the primary Dept
// Head/HR Manager reach a specific one through its source workflow page.
export default async function EvaluationListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; purpose?: string }>;
}) {
  const session = await requireSession();
  if (!isHrAdmin(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }
  const { status, purpose } = await searchParams;

  const where: Prisma.EvaluationWhereInput = {};
  if (status) where.status = status as EvaluationStatus;
  if (purpose) where.purpose = purpose as EvaluationPurpose;

  const evaluations = await prisma.evaluation.findMany({
    where,
    include: { employee: true, p1Employee: true, p2Employee: true },
    orderBy: { createdAt: "desc" },
  });

  const hasFilters = !!(status || purpose);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("evaluation.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("evaluation.listSubtitle")}</p>
        </div>
        <Link href="/evaluations/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("evaluation.createManualButton")}
        </Link>
      </div>

      <form className="mt-4 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.purpose")}</label>
          <select name="purpose" defaultValue={purpose ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {t(`evaluationPurpose.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("evaluation.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`evaluationStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/evaluations" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {evaluations.length === 0 ? (
        <p className="text-sm text-slate-400">{hasFilters ? t("common.noFilteredResults") : t("evaluation.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("evaluation.evaluationNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("evaluation.purpose")}</th>
                <th className="px-4 py-3 font-medium">P1</th>
                <th className="px-4 py-3 font-medium">P2</th>
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
                  <td className="px-4 py-3 text-slate-600">{e.employee.preferredName ?? e.employee.fullLegalName}</td>
                  <td className="px-4 py-3 text-slate-600">{t(`evaluationPurpose.${e.purpose}`)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.p1Employee ? (e.p1Employee.preferredName ?? e.p1Employee.fullLegalName) : "—"}
                    {e.p1SubmittedAt ? " ✓" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.p2Employee ? (e.p2Employee.preferredName ?? e.p2Employee.fullLegalName) : "—"}
                    {e.p2SubmittedAt ? " ✓" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(e.evaluationDueDate)}</td>
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

import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { requireSession } from "@/lib/require-session";
import { isTrainingAdmin } from "@/lib/permissions";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import type { Prisma } from "@/generated/prisma/client";
import type { TrainingRequestStatus } from "@/generated/prisma/enums";

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-amber-700",
  DEPT_HEAD_APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-rose-100 text-rose-700",
  VALIDATED: "bg-indigo-100 text-indigo-700",
  SCHEDULED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function TrainingRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; q?: string }> }) {
  const session = await requireSession();
  const { status, q, page: pageRaw } = await searchParams;

  const isAdmin = isTrainingAdmin(session);
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);

  if (!session.user.employeeId && !isAdmin) {
    return <AccessDenied />;
  }

  const where: Prisma.TrainingRequestWhereInput = {};
  if (status) where.status = status as TrainingRequestStatus;
  const visibilityFilter: Prisma.TrainingRequestWhereInput[] = isAdmin
    ? []
    : [
        {
          OR: [
            { employeeId: session.user.employeeId ?? "__none__" },
            { submittedByAccountId: session.user.id },
            ...(deptHeadDepartmentIds.length > 0 ? [{ departmentIdSnapshot: { in: deptHeadDepartmentIds } }] : []),
          ],
        },
      ];
  const searchFilter: Prisma.TrainingRequestWhereInput[] = q?.trim()
    ? [
        {
          OR: [
            { requestedTopic: { contains: q.trim(), mode: "insensitive" } },
            { requestNumber: { contains: q.trim(), mode: "insensitive" } },
            { employee: { fullLegalName: { contains: q.trim(), mode: "insensitive" } } },
            { employee: { employeeNumber: { contains: q.trim(), mode: "insensitive" } } },
          ],
        },
      ]
    : [];
  if (visibilityFilter.length > 0 || searchFilter.length > 0) where.AND = [...visibilityFilter, ...searchFilter];

  const { page, skip, take } = pageParams(pageRaw);
  const [total, requests] = await Promise.all([
    prisma.trainingRequest.count({ where }),
    prisma.trainingRequest.findMany({
      skip,
      take,
    where,
    include: { employee: { select: { fullLegalName: true, employeeNumber: true } }, course: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  })]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("trainingRequest.listTitle")}</h1>
        </div>
        {session.user.employeeId && (
          <Link href="/training-requests/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("trainingRequest.newRequest")}
          </Link>
        )}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="No., topik, atau nama karyawan"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.filterStatusLabel")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {["SUBMITTED", "DEPT_HEAD_APPROVED", "REJECTED", "VALIDATED", "SCHEDULED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {t(`trainingRequestStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
        <a
          href={`/api/training-requests/export${status ? `?status=${status}` : ""}`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Ekspor CSV
        </a>
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Karyawan</th>
              <th className="px-4 py-3 font-medium">Topik</th>
              <th className="px-4 py-3 font-medium">Pelatihan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  {t("common.noFilteredResults")}
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{r.requestNumber}</td>
                <td className="px-4 py-3">
                  <p className="text-slate-900">{r.employee.fullLegalName}</p>
                  <p className="text-xs text-slate-400">{r.employee.employeeNumber}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{r.requestedTopic}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{r.course?.title ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_TONE[r.status]}`}>
                    {t(`trainingRequestStatus.${r.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/training-requests/${r.id}`} className="text-xs text-indigo-600 hover:underline">
                    Lihat →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} basePath="/training-requests" params={{ status, q }} />
    </div>
  );
}

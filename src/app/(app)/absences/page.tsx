import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EmptyState } from "@/components/empty-state";
import type { Prisma, AbsenceStatus } from "@/generated/prisma/client";

const ABSENCE_STATUSES: AbsenceStatus[] = [
  "SUBMITTED",
  "PENDING_SECOND_APPROVER",
  "PENDING_HR_ADMIN",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

// Per direct request: this operational list/browse view is HR-Admin-only
// now (was HR Admin, or any employee-linked account scoped to their own
// requests/approvals/department). A plain Karyawan only gets the "Ajukan
// Absensi" submit form; deciding a specific request they're the configured
// First Approver for still works via its own detail page
// (/absences/[id], reached from the Dashboard's approval card), which has
// its own narrower, need-to-know access check untouched by this change.
export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; absenceType?: string }>;
}) {
  const session = await requireSession();
  if (!isHrAdmin(session)) {
    return <AccessDenied />;
  }
  const { status, absenceType, page: pageRaw } = await searchParams;

  const where: Prisma.AbsenceRequestWhereInput = {};
  if (status) where.status = status as AbsenceStatus;
  if (absenceType) where.absenceTypeCode = absenceType;

  const { page, skip, take } = pageParams(pageRaw);
  const [total, requests, absenceTypes] = await Promise.all([
    prisma.absenceRequest.count({ where }),
    prisma.absenceRequest.findMany({
      skip,
      take,
      where,
      include: { employee: { select: { employeeNumber: true, fullLegalName: true } }, absenceType: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.absenceTypeConfig.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, label: true } }),
  ]);

  const hasFilters = !!(status || absenceType);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">{t("absence.listTitle")}</h1>
        <div className="flex gap-2">
          <a
            href={`/api/absences/export?${new URLSearchParams({ ...(status ? { status } : {}), ...(absenceType ? { absenceType } : {}) }).toString()}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("common.exportCsvButton")}
          </a>
          <Link
            href="/absences/new"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("absence.newRequest")}
          </Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.filterStatusLabel")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {ABSENCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`absenceStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.filterTypeLabel")}</label>
          <select name="absenceType" defaultValue={absenceType ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {absenceTypes.map((tp) => (
              <option key={tp.code} value={tp.code}>
                {tp.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/absences" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {requests.length === 0 ? (
        <EmptyState message={t("absence.emptyState")} action={{ href: "/absences/new", label: "Ajukan Absensi" }} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Karyawan</th>
                <th className="px-4 py-3 font-medium">{t("absence.typeLabel")}</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/absences/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.employee.fullLegalName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.absenceType.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.startDate.toISOString().slice(0, 10)} – {r.endDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t(`absenceStatus.${r.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} basePath="/absences" params={{ status, absenceType }} />
    </div>
  );
}

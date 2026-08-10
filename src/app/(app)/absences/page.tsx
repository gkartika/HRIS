import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import type { Prisma, AbsenceStatus, AbsenceType } from "@/generated/prisma/client";

const ABSENCE_STATUSES: AbsenceStatus[] = ["SUBMITTED", "PENDING_HR_ADMIN", "APPROVED", "REJECTED", "CANCELLED"];
const ABSENCE_TYPES: AbsenceType[] = ["CUTI", "IZIN", "SAKIT", "LAINNYA"];

export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; absenceType?: string }>;
}) {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);
  const { status, absenceType } = await searchParams;

  if (!isHrAdminUser && !session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const level3DepartmentIds = session.user.employeeId ? await getLevel3DepartmentIds(session.user.employeeId) : [];
  const employee = session.user.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.user.employeeId }, select: { currentPositionId: true } })
    : null;

  const where: Prisma.AbsenceRequestWhereInput = {};
  if (!isHrAdminUser) {
    const scopes: Prisma.AbsenceRequestWhereInput[] = [];
    if (session.user.employeeId) scopes.push({ employeeId: session.user.employeeId });
    if (employee?.currentPositionId) scopes.push({ firstApproverPositionId: employee.currentPositionId });
    if (level3DepartmentIds.length > 0) {
      scopes.push({
        employee: {
          currentPosition: {
            orgUnit: { OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }] },
          },
        },
      });
    }
    where.OR = scopes.length > 0 ? scopes : [{ id: "__none__" }];
  }
  if (status) where.status = status as AbsenceStatus;
  if (absenceType) where.absenceType = absenceType as AbsenceType;

  const requests = await prisma.absenceRequest.findMany({
    where,
    include: { employee: { select: { employeeNumber: true, fullLegalName: true, preferredName: true } } },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  const hasFilters = !!(status || absenceType);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">{t("absence.listTitle")}</h1>
        <div className="flex gap-2">
          {isHrAdminUser && (
            <a
              href={`/api/absences/export?${new URLSearchParams({ ...(status ? { status } : {}), ...(absenceType ? { absenceType } : {}) }).toString()}`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t("attendanceRecords.exportButton")}
            </a>
          )}
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
            {ABSENCE_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`absenceType.${tp}`)}
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
        <p className="text-sm text-slate-400">{t("absence.emptyState")}</p>
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
                  <td className="px-4 py-3">{r.employee.preferredName ?? r.employee.fullLegalName}</td>
                  <td className="px-4 py-3 text-slate-600">{t(`absenceType.${r.absenceType}`)}</td>
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
    </div>
  );
}

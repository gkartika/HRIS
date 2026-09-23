import Link from "next/link";
import { FilePlus } from "lucide-react";
import { requireSession } from "@/lib/require-session";
import { canSubmitRecruitmentRequest, isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { computeFulfillmentCounts } from "@/lib/recruitment";
import type { Prisma, RecruitmentRequestStatus } from "@/generated/prisma/client";

const RECRUITMENT_STATUSES: RecruitmentRequestStatus[] = [
  "DRAFT",
  "PENDING_DEPT_HEAD",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "RECRUITMENT_IN_PROGRESS",
  "PARTIALLY_FILLED",
  "FILLED",
  "CLOSED",
  "CANCELLED",
];

export default async function RecruitmentListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; departmentId?: string }>;
}) {
  const session = await requireSession();
  const { status, departmentId } = await searchParams;

  const where: Prisma.RecruitmentRequestWhereInput = isHrAdmin(session)
    ? {}
    : { requesterEmployeeId: session.user.employeeId ?? "__none__" };
  if (status) where.status = status as RecruitmentRequestStatus;
  if (departmentId) where.departmentId = departmentId;

  const [requests, departments] = await Promise.all([
    prisma.recruitmentRequest.findMany({
      where,
      include: { department: true, job: true, fulfillments: true },
      orderBy: { createdAt: "desc" },
    }),
    // DEPARTMENT-only — RecruitmentRequest.departmentId is meant to be a
    // Department, matched exactly elsewhere in the module (recruitment
    // fulfillment); must not offer Section/Group/Team-tier units here.
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
  ]);

  const hasFilters = !!(status || departmentId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("recruitment.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">Formulir Permintaan Tenaga Kerja Baru (FR-HC-01-01)</p>
        </div>
        <div className="flex items-center gap-2">
          {isHrAdmin(session) && (
            <Link
              href="/employees/new"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Buat Karyawan Langsung (Tanpa Permintaan)
            </Link>
          )}
          {canSubmitRecruitmentRequest(session) && (
            <Link
              href="/recruitment/new"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <FilePlus size={14} />
              {t("recruitment.newRequest")}
            </Link>
          )}
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {RECRUITMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`recruitmentStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.department")}</label>
          <select
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{t("common.allOption")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.unitName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/recruitment" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">
          {hasFilters ? t("common.noFilteredResults") : "Belum ada permintaan tenaga kerja."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("recruitment.requestNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.department")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.job")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.fulfillment")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const counts = computeFulfillmentCounts(r.requestedHeadcount, r.fulfillments.length);
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/recruitment/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        {r.requestNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.department.unitName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.job?.jobTitle ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t("recruitment.filledOf", { filled: counts.filledCount, total: r.requestedHeadcount })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {t(`recruitmentStatus.${r.status}`)}
                      </span>
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

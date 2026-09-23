import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateJobForm } from "./create-form";
import type { Prisma } from "@/generated/prisma/client";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const { q } = await searchParams;

  const where: Prisma.JobWhereInput = {};
  if (q?.trim()) {
    const query = q.trim();
    where.OR = [
      { jobCode: { contains: query, mode: "insensitive" } },
      { jobTitle: { contains: query, mode: "insensitive" } },
    ];
  }

  const [jobs, totalCount] = await Promise.all([
    prisma.job.findMany({ where, orderBy: { jobTitle: "asc" } }),
    prisma.job.count(),
  ]);

  const hasFilters = !!q;

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Jabatan Standar</h1>
      <p className="mt-1 text-sm text-slate-500">
        Definisi jabatan yang dapat dipakai ulang, independen dari orang atau kursi tertentu.
      </p>

      <div className="mt-4">
        <CreateJobForm />
      </div>

      <form className="mt-6 mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Kode atau Nama Jabatan"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/admin/jobs" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {hasFilters && (
        <p className="mb-3 text-xs text-slate-400">
          {t("common.filteredCount", { shown: jobs.length, total: totalCount })}
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">{t("common.noFilteredResults")}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Jabatan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{j.jobCode}</td>
                  <td className="px-4 py-3">{j.jobTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{j.approvalStatus}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/jobs/${j.id}`} className="text-xs text-indigo-600 hover:underline">
                      {t("common.edit")}
                    </Link>
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

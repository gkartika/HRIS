import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageCompetencyFramework } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// Separate Job picker from /admin/jobs (HR-Admin-only Job master data CRUD)
// so Training & Competency Admin (ACC-03) can reach per-Job competency
// requirement config without needing org-structure management access.
export default async function CompetencyRequirementsJobPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (!canManageCompetencyFramework(session)) {
    return <AccessDenied />;
  }

  const { q } = await searchParams;
  const query = q?.trim();

  const [jobs, requirementCounts] = await Promise.all([
    prisma.job.findMany({
      where: query
        ? { OR: [{ jobCode: { contains: query, mode: "insensitive" } }, { jobTitle: { contains: query, mode: "insensitive" } }] }
        : undefined,
      orderBy: { jobTitle: "asc" },
    }),
    prisma.positionCompetencyRequirement.groupBy({ by: ["jobId"], _count: true }),
  ]);
  const countByJobId = new Map(requirementCounts.map((r) => [r.jobId, r._count]));

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("competencyAdmin.requirementsNavHint")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pilih Jabatan Standar untuk melihat atau mengubah persyaratan kompetensinya.
      </p>

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
          {query && (
            <Link href="/admin/competency/requirements" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">{t("common.noFilteredResults")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Jabatan</th>
                <th className="px-4 py-3 font-medium">Kompetensi Dikonfigurasi</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{j.jobCode}</td>
                  <td className="px-4 py-3">{j.jobTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{countByJobId.get(j.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/jobs/${j.id}/competency`} className="text-xs text-indigo-600 hover:underline">
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

import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateJobForm } from "./create-form";

export default async function JobsPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const jobs = await prisma.job.findMany({ orderBy: { jobTitle: "asc" } });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Jabatan Standar</h1>
      <p className="mt-1 text-sm text-slate-500">
        Definisi jabatan yang dapat dipakai ulang, independen dari orang atau kursi tertentu.
      </p>

      <div className="mt-4">
        <CreateJobForm />
      </div>

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
    </div>
  );
}

import Link from "next/link";
import { requireSession, canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreatePositionForm } from "./create-form";

export default async function PositionsPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [positions, jobs, orgUnits] = await Promise.all([
    prisma.position.findMany({
      include: { job: true, orgUnit: true, reportsToPosition: { include: { job: true } } },
      orderBy: { positionCode: "asc" },
    }),
    prisma.job.findMany({ orderBy: { jobTitle: "asc" } }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Posisi Organisasi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kursi jabatan yang disetujui. Sebuah posisi dapat kosong dan tetap ada di struktur.
      </p>

      <div className="mt-4">
        <CreatePositionForm jobs={jobs} orgUnits={orgUnits} positions={positions} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kode</th>
              <th className="px-4 py-3 font-medium">Jabatan</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Melapor Ke</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{p.positionCode}</td>
                <td className="px-4 py-3">{p.job.jobTitle}</td>
                <td className="px-4 py-3 text-slate-600">{p.orgUnit.unitName}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.reportsToPosition ? p.reportsToPosition.job.jobTitle : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{t(`positionStatus.${p.positionStatus}`)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/positions/${p.id}`} className="text-xs text-indigo-600 hover:underline">
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

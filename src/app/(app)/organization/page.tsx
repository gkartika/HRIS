import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

export default async function OrganizationPage() {
  await requireSession();

  const positions = await prisma.position.findMany({
    include: { job: true, orgUnit: true, currentHolders: true, reportsToPosition: { include: { job: true } } },
    orderBy: { positionCode: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("orgChart.title")}</h1>
      <p className="mt-1 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs inline-block">
        {t("orgChart.comingSoon")} Halaman ini sementara menampilkan daftar posisi datar sebagai
        fondasi data — bukan bagan interaktif final (lihat ORG-03/ORG-13 di Build Guide).
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("dataModel.position")}</th>
              <th className="px-4 py-3 font-medium">{t("employee.department")}</th>
              <th className="px-4 py-3 font-medium">Melapor Ke</th>
              <th className="px-4 py-3 font-medium">Pemegang Saat Ini</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{p.job.jobTitle}</td>
                <td className="px-4 py-3 text-slate-600">{p.orgUnit.unitName}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.reportsToPosition?.job.jobTitle ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.currentHolders.length > 0
                    ? p.currentHolders.map((h) => h.preferredName ?? h.fullLegalName).join(", ")
                    : t("positionStatus.VACANT")}
                </td>
                <td className="px-4 py-3 text-slate-600">{t(`positionStatus.${p.positionStatus}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

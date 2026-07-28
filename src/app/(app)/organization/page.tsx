import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getOrgChartData } from "@/lib/org-chart";
import { t } from "@/lib/i18n/id";
import { OrgChartClient } from "./org-chart-client";

export default async function OrganizationPage() {
  await requireSession();

  const [initialData, orgUnits] = await Promise.all([
    getOrgChartData(new Date()),
    prisma.orgUnit.findMany({ where: { activeFlag: true }, orderBy: { unitName: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("orgChart.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Bagan organisasi berbasis Posisi. Klik kartu untuk detail, seret untuk menggeser, gulir
        untuk memperbesar/memperkecil.
      </p>
      <div className="mt-4">
        <OrgChartClient
          initialData={initialData}
          departments={orgUnits.map((u) => ({ id: u.id, name: u.unitName }))}
        />
      </div>
    </div>
  );
}

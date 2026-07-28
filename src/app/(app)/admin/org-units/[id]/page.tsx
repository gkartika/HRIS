import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EditOrgUnitForm } from "./edit-form";

export default async function EditOrgUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [unit, allUnits] = await Promise.all([
    prisma.orgUnit.findUnique({ where: { id } }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
  ]);
  if (!unit) notFound();

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Ubah Unit Organisasi</h1>
      <p className="mt-1 font-mono text-xs text-slate-400">{unit.unitCode}</p>
      <div className="mt-4 max-w-lg">
        <EditOrgUnitForm unit={unit} units={allUnits.filter((u) => u.id !== unit.id)} />
      </div>
    </div>
  );
}

import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { EditOrgUnitForm } from "./edit-form";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function EditOrgUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <AccessDenied />;
  }

  const [unit, allUnits] = await Promise.all([
    prisma.orgUnit.findUnique({ where: { id } }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
  ]);
  if (!unit) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Pengaturan", href: "/admin" }, { label: "Unit Organisasi", href: "/admin/org-units" }, { label: "Detail Unit" }]} />
      <h1 className="text-lg font-medium text-slate-900">Ubah Unit Organisasi</h1>
      <div className="mt-4 max-w-lg">
        <EditOrgUnitForm unit={unit} units={allUnits.filter((u) => u.id !== unit.id)} />
      </div>
    </div>
  );
}

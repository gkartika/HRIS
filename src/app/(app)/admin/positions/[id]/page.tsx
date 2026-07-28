import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EditPositionForm } from "./edit-form";

export default async function EditPositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [position, jobs, orgUnits, allPositions] = await Promise.all([
    prisma.position.findUnique({ where: { id } }),
    prisma.job.findMany({ orderBy: { jobTitle: "asc" } }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ orderBy: { positionCode: "asc" } }),
  ]);
  if (!position) notFound();

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Ubah Posisi Organisasi</h1>
      <p className="mt-1 font-mono text-xs text-slate-400">{position.positionCode}</p>
      <div className="mt-4 max-w-lg">
        <EditPositionForm
          position={position}
          jobs={jobs}
          orgUnits={orgUnits}
          otherPositions={allPositions.filter((p) => p.id !== position.id)}
        />
      </div>
    </div>
  );
}

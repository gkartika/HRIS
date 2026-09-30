import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EditPositionForm } from "./edit-form";
import { ArchivePositionButton } from "./archive-button";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
    // Reporting to an archived Position would hide the subordinate's line
    // behind a seat nobody can see any more — archived ones stay off this
    // picker, same as everywhere else a Position is picked for something new.
    prisma.position.findMany({ where: { archived: false }, orderBy: { positionCode: "asc" } }),
  ]);
  if (!position) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Pengaturan", href: "/admin" }, { label: "Posisi Organisasi", href: "/admin/positions" }, { label: "Detail Posisi" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Ubah Posisi Organisasi</h1>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs text-slate-400">
            {position.positionCode}
            {position.archived && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-sans text-xs font-medium text-slate-500">
                Diarsipkan
              </span>
            )}
          </p>
        </div>
        <ArchivePositionButton positionId={position.id} archived={position.archived} />
      </div>
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

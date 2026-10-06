import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure, canManageCompetencyFramework } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EditJobForm } from "./edit-form";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <AccessDenied />;
  }

  const [job, orgUnits] = await Promise.all([
    prisma.job.findUnique({ where: { id } }),
    prisma.orgUnit.findMany({ orderBy: { unitName: "asc" } }),
  ]);
  if (!job) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Pengaturan", href: "/admin" }, { label: "Jabatan Standar", href: "/admin/jobs" }, { label: "Detail Jabatan" }]} />
      <h1 className="text-lg font-medium text-slate-900">Ubah Jabatan Standar</h1>
      <p className="mt-1 font-mono text-xs text-slate-400">{job.jobCode}</p>
      <div className="mt-4 max-w-lg">
        <EditJobForm job={job} orgUnits={orgUnits} />
      </div>
      {canManageCompetencyFramework(session) && (
        <div className="mt-6">
          <Link href={`/admin/jobs/${job.id}/competency`} className="text-sm text-indigo-600 hover:underline">
            {t("competencyAdmin.requirementsNavHint")} →
          </Link>
        </div>
      )}
    </div>
  );
}

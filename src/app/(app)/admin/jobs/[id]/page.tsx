import { notFound } from "next/navigation";
import { requireSession, canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EditJobForm } from "./edit-form";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Ubah Jabatan Standar</h1>
      <p className="mt-1 font-mono text-xs text-slate-400">{job.jobCode}</p>
      <div className="mt-4 max-w-lg">
        <EditJobForm job={job} />
      </div>
    </div>
  );
}

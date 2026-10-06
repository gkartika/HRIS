import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canManageCompetencyFramework } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { JobCompetencyRequirementForm } from "./requirement-form";

export default async function JobCompetencyRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const session = await requireSession();
  if (!canManageCompetencyFramework(session)) {
    return <AccessDenied />;
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();

  const [definitions, requirements] = await Promise.all([
    prisma.competencyDefinition.findMany({
      where: { activeFlag: true, frameworkVersion: { status: "ACTIVE" } },
      orderBy: [{ category: "asc" }, { subcategory: "asc" }, { displayOrder: "asc" }],
    }),
    prisma.positionCompetencyRequirement.findMany({ where: { jobId: id } }),
  ]);

  const requirementByDefId = new Map(requirements.map((r) => [r.competencyDefinitionId, r]));

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("competencyRequirements.title", { jobTitle: job.jobTitle })}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("competencyRequirements.subtitle")}</p>

      {saved && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {t("competencyRequirements.savedNotice")}
        </p>
      )}

      {definitions.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">{t("competencyRequirements.noDefinitionsWarning")}</p>
      ) : (
        <JobCompetencyRequirementForm
          jobId={id}
          definitions={definitions.map((d) => ({
            id: d.id,
            category: d.category,
            subcategory: d.subcategory,
            name: d.name,
          }))}
          requirementByDefId={Object.fromEntries(
            [...requirementByDefId.entries()].map(([defId, r]) => [defId, { isRequired: r.isRequired, targetLevel: r.targetLevel }])
          )}
        />
      )}
    </div>
  );
}

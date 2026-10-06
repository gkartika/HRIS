import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageCompetencyFramework } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

const LEVELS = [1, 2, 3, 4, 5];
const SCORES = [0, 25, 50, 75, 100];

export default async function CompetencyFrameworkPage() {
  const session = await requireSession();
  if (!canManageCompetencyFramework(session)) {
    return <AccessDenied />;
  }

  const [competencyFrameworkVersion, companyValueFrameworkVersion] = await Promise.all([
    prisma.competencyFrameworkVersion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
      include: {
        definitions: {
          where: { activeFlag: true },
          orderBy: [{ category: "asc" }, { subcategory: "asc" }, { displayOrder: "asc" }],
          include: { levelIndicators: { orderBy: { level: "asc" } } },
        },
      },
    }),
    prisma.companyValueFrameworkVersion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
      include: {
        definitions: {
          orderBy: { displayOrder: "asc" },
          include: { rubricIndicators: { orderBy: { score: "asc" } } },
        },
      },
    }),
  ]);

  type CompetencyDefinitionRow = NonNullable<typeof competencyFrameworkVersion>["definitions"][number];
  const grouped = new Map<string, CompetencyDefinitionRow[]>();
  if (competencyFrameworkVersion) {
    for (const def of competencyFrameworkVersion.definitions) {
      const key = `${def.category}::${def.subcategory}`;
      const list = grouped.get(key) ?? [];
      list.push(def);
      grouped.set(key, list);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("competencyAdmin.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("competencyAdmin.subtitle")}</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <Link href="/admin/competency/requirements" className="text-indigo-600 hover:underline">
          {t("competencyAdmin.requirementsNavHint")} →
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-medium text-slate-900">{t("competencyAdmin.competencySectionTitle")}</h2>
      {!competencyFrameworkVersion ? (
        <p className="mt-2 text-sm text-slate-400">{t("competencyAdmin.noActiveFramework")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-400">
            {t("competencyAdmin.frameworkVersionLabel")}: {competencyFrameworkVersion.versionLabel}
            {competencyFrameworkVersion.sourceDocDate
              ? ` — ${competencyFrameworkVersion.sourceDocDate.toISOString().slice(0, 10)}`
              : ""}
          </p>
          <div className="mt-4 space-y-6">
            {[...grouped.entries()].map(([key, defs]) => {
              const [category, subcategory] = key.split("::");
              return (
                <div key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                    {t(`competencyCategory.${category}`)} — {subcategory}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Kompetensi</th>
                        {LEVELS.map((lvl) => (
                          <th key={lvl} className="px-4 py-2 font-medium">
                            {t("competencyAdmin.levelColumnLabel", { level: lvl })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {defs.map((def) => (
                        <tr key={def.id} className="border-t border-slate-100 align-top">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{def.name}</p>
                            {def.description && <p className="mt-1 text-xs text-slate-500">{def.description}</p>}
                            {def.aliasesCsv && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                {t("competencyAdmin.aliasNote", { aliases: def.aliasesCsv })}
                              </p>
                            )}
                          </td>
                          {LEVELS.map((lvl) => {
                            const indicator = def.levelIndicators.find((li) => li.level === lvl);
                            return (
                              <td key={lvl} className="px-4 py-3 text-xs text-slate-600">
                                {indicator?.indicatorText ?? "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mt-10 text-sm font-medium text-slate-900">{t("competencyAdmin.companyValuesSectionTitle")}</h2>
      {!companyValueFrameworkVersion ? (
        <p className="mt-2 text-sm text-slate-400">{t("competencyAdmin.noActiveFramework")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-400">
            {t("competencyAdmin.frameworkVersionLabel")}: {companyValueFrameworkVersion.versionLabel}
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nilai</th>
                  {SCORES.map((s) => (
                    <th key={s} className="px-4 py-2 font-medium">
                      {t("competencyAdmin.scoreColumnLabel", { score: s })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companyValueFrameworkVersion.definitions.map((def) => (
                  <tr key={def.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{def.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("competencyAdmin.weightLabel", { weight: def.weight })}
                      </p>
                    </td>
                    {SCORES.map((s) => {
                      const indicator = def.rubricIndicators.find((ri) => ri.score === s);
                      return (
                        <td key={s} className="min-w-[220px] whitespace-pre-line px-4 py-3 text-xs text-slate-600">
                          {indicator?.indicatorText ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

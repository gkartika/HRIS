"use client";

import { useActionState, useState } from "react";
import { saveJobCompetencyRequirements } from "./actions";
import { t } from "@/lib/i18n/id";

interface DefinitionRow {
  id: string;
  category: string;
  subcategory: string;
  name: string;
}

const LEVELS = [1, 2, 3, 4, 5];

export function JobCompetencyRequirementForm({
  jobId,
  definitions,
  requirementByDefId,
}: {
  jobId: string;
  definitions: DefinitionRow[];
  requirementByDefId: Record<string, { isRequired: boolean; targetLevel: number | null }>;
}) {
  const [error, formAction, isPending] = useActionState(saveJobCompetencyRequirements.bind(null, jobId), undefined);
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(definitions.map((d) => [d.id, requirementByDefId[d.id]?.isRequired ?? false]))
  );

  const grouped = new Map<string, DefinitionRow[]>();
  for (const def of definitions) {
    const key = `${def.category}::${def.subcategory}`;
    const list = grouped.get(key) ?? [];
    list.push(def);
    grouped.set(key, list);
  }

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

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
                  <th className="px-4 py-2 font-medium">{t("competencyRequirements.requiredColumnLabel")}</th>
                  <th className="px-4 py-2 font-medium">{t("competencyRequirements.targetLevelColumnLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {defs.map((def) => {
                  const existing = requirementByDefId[def.id];
                  const isChecked = checkedState[def.id] ?? false;
                  return (
                    <tr key={def.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-900">{def.name}</td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          name={`required_${def.id}`}
                          defaultChecked={isChecked}
                          onChange={(e) => setCheckedState((prev) => ({ ...prev, [def.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          name={`level_${def.id}`}
                          defaultValue={existing?.targetLevel ?? ""}
                          disabled={!isChecked}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-300"
                        >
                          <option value="">{t("competencyRequirements.naOption")}</option>
                          {LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : t("competencyRequirements.saveButton")}
      </button>
    </form>
  );
}

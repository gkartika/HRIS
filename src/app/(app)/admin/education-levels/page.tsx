import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateEducationLevelForm } from "./create-form";
import { ToggleActiveForm } from "./toggle-form";

export default async function EducationLevelsPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const levels = await prisma.educationLevel.findMany({
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Pendidikan Terakhir</h1>
      <p className="mt-1 text-sm text-slate-500">
        Daftar pilihan dropdown untuk field Pendidikan Terakhir pada data karyawan.
      </p>

      <div className="mt-4">
        <CreateEducationLevelForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{l.label}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      l.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {l.activeFlag ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleActiveForm levelId={l.id} currentActive={l.activeFlag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreatePtkpStatusForm } from "./create-form";
import { ToggleActiveForm } from "./toggle-form";

export default async function PtkpStatusPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const statuses = await prisma.ptkpStatus.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">PTKP Pajak</h1>
      <p className="mt-1 text-sm text-slate-500">
        Daftar kode status PTKP untuk field PTKP Pajak pada data karyawan.
      </p>

      <div className="mt-4">
        <CreatePtkpStatusForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kode</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3">{s.label}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      s.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.activeFlag ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleActiveForm statusId={s.id} currentActive={s.activeFlag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

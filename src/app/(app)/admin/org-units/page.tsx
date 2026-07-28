import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CreateOrgUnitForm } from "./create-form";

export default async function OrgUnitsPage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const units = await prisma.orgUnit.findMany({
    orderBy: [{ displayOrder: "asc" }, { unitName: "asc" }],
    include: { parentUnit: true },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Unit Organisasi</h1>
      <p className="mt-1 text-sm text-slate-500">Departemen, Seksi, Grup, dan Tim.</p>

      <div className="mt-4">
        <CreateOrgUnitForm units={units} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kode</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Jenis</th>
              <th className="px-4 py-3 font-medium">Induk</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{u.unitCode}</td>
                <td className="px-4 py-3">{u.unitName}</td>
                <td className="px-4 py-3 text-slate-600">{u.unitType}</td>
                <td className="px-4 py-3 text-slate-600">{u.parentUnit?.unitName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      u.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {u.activeFlag ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/org-units/${u.id}`} className="text-xs text-indigo-600 hover:underline">
                    {t("common.edit")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

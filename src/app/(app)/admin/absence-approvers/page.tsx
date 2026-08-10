import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ApproverRowForm } from "./approver-row-form";

export default async function AbsenceApproversPage() {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [departments, positions, configs] = await Promise.all([
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } }),
    prisma.absenceApproverConfig.findMany(),
  ]);

  const configByDepartmentId = new Map(configs.map((c) => [c.departmentId, c.approverPositionId]));
  const positionOptions = positions.map((p) => ({
    id: p.id,
    label: `${p.jobLevel} ${p.job.jobTitle} — ${p.orgUnit.unitName}`,
  }));

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Penyetuju Pertama Absensi (Cuti/Izin/Sakit/Lainnya)</h1>
      <p className="mt-1 text-sm text-slate-500">
        Setiap Departemen memiliki satu Posisi yang menjadi penyetuju tahap pertama sebelum HR Admin. Tanpa pengaturan
        ini, pengajuan Absensi dari Departemen tersebut tidak dapat diproses ke tahap pertama.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Departemen</th>
              <th className="px-4 py-3 font-medium">Penyetuju Pertama</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{d.unitName}</td>
                <td className="px-4 py-3">
                  <ApproverRowForm
                    departmentId={d.id}
                    positions={positionOptions}
                    currentApproverPositionId={configByDepartmentId.get(d.id) ?? null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {departments.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada Departemen.</p>}
      </div>
    </div>
  );
}

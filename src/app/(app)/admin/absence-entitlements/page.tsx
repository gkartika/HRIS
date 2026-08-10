import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EntitlementRowForm } from "./entitlement-row-form";
import type { AbsenceType } from "@/generated/prisma/enums";

const ABSENCE_TYPES: AbsenceType[] = ["CUTI", "IZIN", "SAKIT", "LAINNYA"];

export default async function AbsenceEntitlementsPage() {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const configs = await prisma.absenceEntitlementConfig.findMany();
  const daysByType = new Map(configs.map((c) => [c.absenceType, c.annualDays]));

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Jatah Absensi Tahunan</h1>
      <p className="mt-1 text-sm text-slate-500">
        Jumlah hari per tahun untuk setiap jenis Absensi. Nilai 0 berarti tidak ada jatah tetap (mis. Izin/Sakit/Lainnya
        umumnya dievaluasi kasus per kasus, bukan dibatasi jatah tahunan).
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Jenis Absensi</th>
              <th className="px-4 py-3 font-medium">Jatah Tahunan</th>
            </tr>
          </thead>
          <tbody>
            {ABSENCE_TYPES.map((type) => (
              <tr key={type} className="border-t border-slate-100">
                <td className="px-4 py-3">{t(`absenceType.${type}`)}</td>
                <td className="px-4 py-3">
                  <EntitlementRowForm absenceType={type} currentAnnualDays={daysByType.get(type) ?? 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

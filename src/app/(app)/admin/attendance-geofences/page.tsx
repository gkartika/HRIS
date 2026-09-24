import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SettingsTabs } from "../settings-tabs";
import { CreateGeofenceForm } from "./create-form";
import { ToggleActiveForm } from "./toggle-form";

export default async function AttendanceGeofencesPage() {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const geofences = await prisma.attendanceGeofence.findMany({ orderBy: { siteName: "asc" } });

  return (
    <div>
      <SettingsTabs groupId="absensi" current="/admin/attendance-geofences" />
      <h1 className="text-lg font-medium text-slate-900">Lokasi Absensi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Titik lokasi dan radius yang dipakai untuk pengecekan Check-in/Check-out Mobile karyawan.
      </p>

      <div className="mt-4">
        <CreateGeofenceForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Lokasi</th>
              <th className="px-4 py-3 font-medium">Koordinat</th>
              <th className="px-4 py-3 font-medium">Radius</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {geofences.map((g) => (
              <tr key={g.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{g.siteName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {g.latitude}, {g.longitude}
                </td>
                <td className="px-4 py-3 text-slate-600">{g.radiusMeters} m</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      g.activeFlag ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {g.activeFlag ? t("common.active") : t("common.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleActiveForm geofenceId={g.id} currentActive={g.activeFlag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {geofences.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada lokasi absensi.</p>}
      </div>
    </div>
  );
}

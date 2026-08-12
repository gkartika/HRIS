import Link from "next/link";

export interface GapTableRow {
  id: string;
  employee: { fullLegalName: string; preferredName: string | null; employeeNumber: string };
  position: { job: { jobTitle: string } } | null;
  competencyAchievementPct: number | null;
  companyValuesScore: number | null;
  completedAt: Date | null;
}

export function GapTable({ rows, title }: { rows: GapTableRow[]; title: string }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Karyawan</th>
            <th className="px-4 py-3 font-medium">Posisi</th>
            <th className="px-4 py-3 font-medium">Capaian Kompetensi</th>
            <th className="px-4 py-3 font-medium">Skor Tata Nilai</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-xs text-slate-400">
                Tidak ada data.
              </td>
            </tr>
          )}
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="px-4 py-3">
                <p className="text-slate-900">{a.employee.preferredName ?? a.employee.fullLegalName}</p>
                <p className="text-xs text-slate-400">{a.employee.employeeNumber}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">{a.position?.job.jobTitle ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {a.competencyAchievementPct !== null ? `${a.competencyAchievementPct.toFixed(1)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">{a.companyValuesScore !== null ? a.companyValuesScore.toFixed(1) : "—"}</td>
              <td className="px-4 py-3 text-xs">
                {a.completedAt ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Selesai</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Berjalan</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/competency/assessments/${a.id}`} className="text-xs text-indigo-600 hover:underline">
                  Lihat →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

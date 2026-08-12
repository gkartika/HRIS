import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";

// COM-10: "Employees may see only their own finalized results" — an
// in-progress assessment (P1 and/or P2 not yet submitted) is intentionally
// excluded here, not just hidden on click-through.
export default async function MyCompetencyPage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const assessments = await prisma.competencyAssessment.findMany({
    where: { employeeId: session.user.employeeId, completedAt: { not: null } },
    include: {
      cycle: { select: { periodLabel: true, cycleCode: true, isHistorical: true } },
      position: { select: { job: { select: { jobTitle: true } } } },
    },
    orderBy: { cycle: { openedAt: "desc" } },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Penilaian Kompetensi Saya</h1>
      <p className="mt-1 text-sm text-slate-500">Hasil penilaian yang sudah selesai (finalisasi P1 dan P2) terhadap Posisi Utama Anda.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Siklus</th>
              <th className="px-4 py-3 font-medium">Posisi</th>
              <th className="px-4 py-3 font-medium">Capaian Kompetensi</th>
              <th className="px-4 py-3 font-medium">Skor Tata Nilai</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada hasil penilaian yang selesai.
                </td>
              </tr>
            )}
            {assessments.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  {a.cycle.periodLabel}
                  {a.cycle.isHistorical && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Migrasi Historis</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.position?.job.jobTitle ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {a.competencyAchievementPct !== null ? `${a.competencyAchievementPct.toFixed(1)}%` : "N/A"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.companyValuesScore !== null ? a.companyValuesScore.toFixed(1) : "—"}</td>
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
    </div>
  );
}

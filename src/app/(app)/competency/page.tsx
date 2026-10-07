import { StatusChip } from "@/components/status-chip";
import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canOpenCompetencyCycle, isTrainingAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { OpenCompetencyCycleForm } from "./open-cycle-form";

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default async function CompetencyCyclesPage() {
  const session = await requireSession();
  const canOpen = canOpenCompetencyCycle(session);
  const canSeeAll = isTrainingAdmin(session);

  if (!canSeeAll) {
    return <AccessDenied />;
  }

  const cycles = await prisma.competencyAssessmentCycle.findMany({
    where: { isHistorical: false },
    orderBy: { openedAt: "desc" },
    include: { _count: { select: { assessments: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Siklus Penilaian Kompetensi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Penilaian kompetensi dan Tata Nilai dijalankan dua kali setahun terhadap Posisi Utama setiap karyawan aktif.
      </p>

      {canOpen && (
        <div className="mt-4">
          <OpenCompetencyCycleForm />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kode Siklus</th>
              <th className="px-4 py-3 font-medium">Periode</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Jumlah Penilaian</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada siklus penilaian.
                </td>
              </tr>
            )}
            {cycles.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{c.cycleCode}</td>
                <td className="px-4 py-3">{c.periodLabel}</td>
                <td className="px-4 py-3">
                  <StatusChip tone={STATUS_TONE[c.status]} shape="pill">{c.status}</StatusChip>
                </td>
                <td className="px-4 py-3 text-slate-600">{c._count.assessments}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/competency/cycles/${c.id}`} className="text-xs text-indigo-600 hover:underline">
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

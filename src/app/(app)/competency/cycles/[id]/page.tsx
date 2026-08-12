import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin, canOpenCompetencyCycle } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { CloseCycleButton } from "./close-cycle-button";

export default async function CompetencyCycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!isHrAdmin(session) && !isTrainingAdmin(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const cycle = await prisma.competencyAssessmentCycle.findUnique({ where: { id } });
  if (!cycle) notFound();

  const assessments = await prisma.competencyAssessment.findMany({
    where: { cycleId: id },
    include: {
      employee: { select: { fullLegalName: true, preferredName: true, employeeNumber: true } },
      position: { select: { positionCode: true, job: { select: { jobTitle: true } } } },
      p1Employee: { select: { fullLegalName: true, preferredName: true } },
      p2Employee: { select: { fullLegalName: true, preferredName: true } },
    },
    orderBy: { employee: { fullLegalName: "asc" } },
  });

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">
            {cycle.periodLabel} <span className="font-mono text-sm text-slate-400">({cycle.cycleCode})</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Status: {cycle.status} — {assessments.length} penilaian
          </p>
        </div>
        {cycle.status === "OPEN" && canOpenCompetencyCycle(session) && <CloseCycleButton cycleId={cycle.id} />}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Karyawan</th>
              <th className="px-4 py-3 font-medium">Posisi</th>
              <th className="px-4 py-3 font-medium">P1</th>
              <th className="px-4 py-3 font-medium">P2</th>
              <th className="px-4 py-3 font-medium">Capaian Kompetensi</th>
              <th className="px-4 py-3 font-medium">Skor Tata Nilai</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="text-slate-900">{a.employee.preferredName ?? a.employee.fullLegalName}</p>
                  <p className="text-xs text-slate-400">{a.employee.employeeNumber}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.position?.job.jobTitle ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {a.p1Employee ? (a.p1Employee.preferredName ?? a.p1Employee.fullLegalName) : "—"}
                  {a.p1SubmittedAt && <span className="ml-1 text-emerald-600">✓</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {a.p2Employee ? (a.p2Employee.preferredName ?? a.p2Employee.fullLegalName) : "—"}
                  {a.p2SubmittedAt && <span className="ml-1 text-emerald-600">✓</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {a.competencyAchievementPct !== null ? `${a.competencyAchievementPct.toFixed(1)}%` : "—"}
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

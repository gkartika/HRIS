import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  isTrainingAdmin,
  canScoreAsCompetencyP1,
  canScoreAsCompetencyP2,
  canReassignCompetencyEvaluator,
  canViewCompetencyAssessment,
} from "@/lib/permissions";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { getActiveDirectorCandidates } from "@/lib/org-chart";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { P1ScoringForm } from "./p1-scoring-form";
import { P2ScoringForm } from "./p2-scoring-form";
import { ReassignEvaluatorForm } from "./reassign-form";

export default async function CompetencyAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const assessment = await prisma.competencyAssessment.findUnique({
    where: { id },
    include: {
      cycle: true,
      employee: { select: { id: true, fullLegalName: true, employeeNumber: true } },
      position: { select: { positionCode: true, job: { select: { jobTitle: true } } } },
      p1Employee: { select: { fullLegalName: true } },
      p2Employee: { select: { fullLegalName: true } },
      items: { orderBy: [{ categorySnapshot: "asc" }, { competencyNameSnapshot: "asc" }] },
      valueItems: { orderBy: { valueNameSnapshot: "asc" } },
      evaluatorChanges: {
        orderBy: { changedAt: "desc" },
        include: { oldEmployee: { select: { fullLegalName: true } }, newEmployee: { select: { fullLegalName: true } } },
      },
    },
  });
  if (!assessment) notFound();

  const isAdmin = isTrainingAdmin(session);
  const isLevel3InDept = isAdmin ? false : await isLevel3ForEmployeeDepartment(session.user.employeeId, assessment.employeeId);
  const directorCandidates = isAdmin ? [] : await getActiveDirectorCandidates();
  const myDirectorPositionIds = directorCandidates
    .filter((c) => c.employeeId === session.user.employeeId)
    .map((c) => c.positionId);

  const canView = canViewCompetencyAssessment(
    session,
    assessment.employeeId,
    assessment.p1EmployeeId,
    assessment.p2EmployeeId,
    assessment.completedAt,
    isLevel3InDept,
    myDirectorPositionIds
  );
  if (!canView) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const isP1 = canScoreAsCompetencyP1(session.user.employeeId, assessment.p1EmployeeId);
  const isP2 = canScoreAsCompetencyP2(session.user.employeeId, assessment.p2EmployeeId);
  const canScoreP1 = isP1 && !assessment.p1SubmittedAt;
  const canScoreP2 = isP2 && !assessment.p2SubmittedAt;
  const canReassign = canReassignCompetencyEvaluator(session) && assessment.cycle.status === "OPEN";
  const isComplete = assessment.completedAt !== null;

  const canSeeP1Scores = isAdmin || isP1 || isComplete;
  const canSeeP2Scores = isAdmin || isP2 || isComplete;

  const employeeOptions = canReassign
    ? await prisma.employee.findMany({
        where: { activeFlag: true },
        select: { id: true, employeeNumber: true, fullLegalName: true },
        orderBy: { fullLegalName: "asc" },
      })
    : [];

  const employeeName = assessment.employee.fullLegalName;

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Penilaian Kompetensi — {employeeName}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {assessment.employee.employeeNumber} · {assessment.position?.job.jobTitle ?? "—"} · {assessment.cycle.periodLabel}
        {assessment.isLevel3AtSnapshot && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">Level 3</span>}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">P1 {assessment.isLevel3AtSnapshot ? "(Direktur)" : "(Atasan Posisi Utama)"}</p>
          <p className="mt-1 text-sm text-slate-900">
            {assessment.p1Employee ? (assessment.p1Employee.fullLegalName) : "Belum ditentukan"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {assessment.p1SubmittedAt ? `Dikirim ${assessment.p1SubmittedAt.toISOString().slice(0, 10)}` : "Belum dikirim"}
          </p>
          {canReassign && <ReassignEvaluatorForm assessmentId={assessment.id} slot="P1" employees={employeeOptions} />}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">P2 {assessment.isLevel3AtSnapshot ? "(HR Manager)" : "(Kepala Departemen)"}</p>
          <p className="mt-1 text-sm text-slate-900">
            {assessment.p2Employee ? (assessment.p2Employee.fullLegalName) : "Belum ditentukan"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {assessment.p2SubmittedAt ? `Dikirim ${assessment.p2SubmittedAt.toISOString().slice(0, 10)}` : "Belum dikirim"}
          </p>
          {canReassign && <ReassignEvaluatorForm assessmentId={assessment.id} slot="P2" employees={employeeOptions} />}
        </div>
      </div>

      {isComplete && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">Capaian Kompetensi</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">
              {assessment.competencyAchievementPct !== null ? `${assessment.competencyAchievementPct.toFixed(1)}%` : "N/A"}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">Skor Tata Nilai</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">
              {assessment.companyValuesScore !== null ? assessment.companyValuesScore.toFixed(1) : "—"}
            </p>
          </div>
        </div>
      )}

      {canScoreP1 ? (
        <P1ScoringForm assessmentId={assessment.id} items={assessment.items} valueItems={assessment.valueItems} />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">Kompetensi (Posisi Utama)</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Kompetensi</th>
                <th className="px-4 py-2 font-medium">Kategori</th>
                <th className="px-4 py-2 font-medium">Level Disyaratkan</th>
                <th className="px-4 py-2 font-medium">Level Aktual</th>
                <th className="px-4 py-2 font-medium">Gap Kompetensi</th>
              </tr>
            </thead>
            <tbody>
              {assessment.items.map((item) => {
                const actual = canSeeP1Scores ? item.actualLevel : null;
                const gap = actual !== null && item.requiredLevel !== null ? Math.max(item.requiredLevel - actual, 0) : null;
                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{item.competencyNameSnapshot}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{t(`competencyCategory.${item.categorySnapshot}`)}</td>
                    <td className="px-4 py-2 text-slate-600">{item.requiredLevel ?? "N/A"}</td>
                    <td className="px-4 py-2 text-slate-600">{canSeeP1Scores ? (actual ?? "—") : "Disembunyikan"}</td>
                    <td className="px-4 py-2 text-slate-600">{gap ?? "—"}</td>
                  </tr>
                );
              })}
              {assessment.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-xs text-slate-400">
                    Tidak ada kompetensi wajib yang dikonfigurasi untuk Jabatan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {canScoreP2 ? (
        <P2ScoringForm assessmentId={assessment.id} valueItems={assessment.valueItems} />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">Tata Nilai Perusahaan</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nilai</th>
                <th className="px-4 py-2 font-medium">Bobot</th>
                <th className="px-4 py-2 font-medium">Skor P1</th>
                <th className="px-4 py-2 font-medium">Skor P2</th>
              </tr>
            </thead>
            <tbody>
              {assessment.valueItems.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">{v.valueNameSnapshot}</td>
                  <td className="px-4 py-2 text-slate-600">{v.weightSnapshot}%</td>
                  <td className="px-4 py-2 text-slate-600">{canSeeP1Scores ? (v.p1Score ?? "—") : "Disembunyikan"}</td>
                  <td className="px-4 py-2 text-slate-600">{canSeeP2Scores ? (v.p2Score ?? "—") : "Disembunyikan"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assessment.evaluatorChanges.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-medium text-slate-500">Riwayat Penggantian P1/P2</h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {assessment.evaluatorChanges.map((c) => (
              <li key={c.id}>
                {c.changedAt.toISOString().slice(0, 10)} — {c.slot}: {c.oldEmployee?.fullLegalName ?? "(kosong)"} →{" "}
                {c.newEmployee.fullLegalName}. Alasan: {c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

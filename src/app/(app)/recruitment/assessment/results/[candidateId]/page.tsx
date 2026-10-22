import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { RISK_SIGNAL_TONE, SCREENING_TONE } from "@/lib/assessment-ui";
import { formatDateTimeMedium } from "@/lib/format";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { t } from "@/lib/i18n/id";
import { canViewAssessmentResults } from "@/lib/permissions";
import { isMaterialConcern } from "@/lib/recruitment-assessment";
import { finalizeExpiredAssessments, loadAssessmentResult } from "@/lib/recruitment-assessment-service";
import { requireSession } from "@/lib/require-session";

export default async function AssessmentResultPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const session = await requireSession();
  const hrManagerIds = (await getActiveHrManagerPositions(session.user.employeeId)).map((p) => p.positionId);
  if (!canViewAssessmentResults(session, hrManagerIds)) return <AccessDenied />;

  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, fullName: true, source: true, employee: { select: { fullLegalName: true, employeeNumber: true } }, request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } } },
  });
  if (!candidate) notFound();
  await finalizeExpiredAssessments(candidateId);
  const result = await loadAssessmentResult(candidateId);
  await logAudit({ actorAccountId: session.user.id, action: "VIEW", datasetName: "RecruitmentAssessmentSubmission", recordId: result?.id ?? candidateId });

  const heading = (
    <>
      <Breadcrumbs items={[{ label: t("assessment.rubricNav"), href: "/recruitment/assessment" }, { label: t("assessment.result.title"), href: "/recruitment/assessment/results" }, { label: candidate.fullName }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{t("assessment.result.title")}: {candidate.fullName}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{candidate.request.job?.jobTitle ?? "Lowongan"} · {candidate.request.department.unitName}</p>
        {candidate.source === "INTERNAL" && (
          <p className="mt-1 text-sm">
            <StatusChip tone="bg-indigo-50 text-indigo-700">Internal</StatusChip>{" "}
            <span className="text-slate-600">Karyawan: {candidate.employee ? `${candidate.employee.fullLegalName} (${candidate.employee.employeeNumber})` : "-"}</span>
          </p>
        )}
        <p className="mt-2 max-w-3xl rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{t("assessment.result.disclaimer")}</p>
      </div>
    </>
  );

  if (!result) return <div className="space-y-5">{heading}<p className="text-sm text-slate-500">{t("assessment.result.notStarted")}</p></div>;
  if (result.status === "IN_PROGRESS") {
    return (
      <div className="space-y-5">
        {heading}
        <StatusChip tone={SCREENING_TONE.INCOMPLETE}>{t("assessment.result.screening.INCOMPLETE")}</StatusChip>
        <p className="text-sm text-slate-600">{t("assessment.result.inProgress", { n: result._count.answers })}</p>
        <p className="text-xs text-slate-400">{t("assessment.result.versions")}: {result.version.versionLabel} / {result.rubric.rubricLabel}</p>
      </div>
    );
  }

  // Time ran out with questions left: closed without a score, the answers given are kept.
  if (result.screeningStatus === "INCOMPLETE" || result.totalScore === null) {
    return (
      <div className="space-y-5">
        {heading}
        <StatusChip tone={SCREENING_TONE.INCOMPLETE}>{t("assessment.result.screening.INCOMPLETE")}</StatusChip>
        <p className="text-sm text-slate-600">{t("assessment.result.timedOut", { menit: result.timeLimitMinutes, n: result._count.answers, total: 20 })}</p>
        <p className="text-xs text-slate-400">{t("assessment.result.versions")}: {result.version.versionLabel} / {result.rubric.rubricLabel}{result.submittedAt ? ` · ${t("assessment.result.submittedAt")} ${formatDateTimeMedium(result.submittedAt)}` : ""}</p>
      </div>
    );
  }
  const status = result.screeningStatus ?? "INCOMPLETE";
  const material = result.items.filter((i) => isMaterialConcern(i));

  return (
    <div className="space-y-5">
      {heading}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("assessment.result.status")}</p>
          <div className="mt-1"><StatusChip tone={SCREENING_TONE[status]}>{t(`assessment.result.screening.${status}`)}</StatusChip></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("assessment.result.score")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{result.totalScore}</p>
          <p className="text-[11px] text-slate-400">0 sampai -19</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("assessment.result.versions")}</p>
          <p className="mt-1 text-sm font-medium text-slate-900">Asesmen {result.version.versionLabel} · rubrik {result.rubric.rubricLabel}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {t("assessment.result.submittedAt")} {result.submittedAt ? formatDateTimeMedium(result.submittedAt) : "-"} · {t("assessment.result.scoredAt")} {result.scoredAt ? formatDateTimeMedium(result.scoredAt) : "-"}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-rose-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">{t("assessment.result.material")}</h2>
        {material.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">{t("assessment.result.materialNone")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {material.map((i) => (
              <li key={i.id} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-slate-800">
                <span className="font-semibold">Soal {i.questionNo}{i.optionKey}</span> · {i.primaryDimension} — {i.observation}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-900">{t("assessment.result.allAnswers", { n: result.items.length })}</h2>
        {result.items.map((i) => (
          <details key={i.id} className={`rounded-xl border bg-white p-4 ${isMaterialConcern(i) ? "border-rose-300" : "border-slate-200"}`}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-slate-900">Soal {i.questionNo}{i.optionKey}</span>
              <StatusChip tone={RISK_SIGNAL_TONE[String(i.riskSignal)]}>{i.riskSignal}</StatusChip>
              <span className="text-xs text-slate-500">{i.primaryDimension}</span>
              <span className="flex-1 text-slate-700">{i.observation}</span>
            </summary>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">{t("assessment.result.question")}</p>
                <p className="whitespace-pre-line text-slate-700">{i.questionText}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("assessment.result.selected")}</p>
                <p className="text-slate-800"><span className="font-semibold">{i.optionKey}.</span> {i.optionText}</p>
              </div>
              <p className="text-[11px] text-slate-400">{t("assessment.result.trace", { rubrik: result.rubric.rubricLabel, id: i.interpretationId })}</p>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { RISK_SIGNAL_TONE, RUBRIC_STATUS_TONE } from "@/lib/assessment-ui";
import { formatDateTimeMedium } from "@/lib/format";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { t } from "@/lib/i18n/id";
import { canApproveAssessmentRubric, canManageAssessmentRubric, canViewAssessmentRubric } from "@/lib/permissions";
import { getRubricDetail } from "@/lib/recruitment-assessment-service";
import { isRubricEditable, type RubricStatus } from "@/lib/recruitment-assessment";
import { requireSession } from "@/lib/require-session";
import { InterpretationForm, RubricSteps } from "../rubric-forms";

const EVENT_LABEL: Record<string, string> = {
  IMPORTED: "Diimpor sebagai draf",
  CREATED: "Revisi dibuat",
  EDITED: "Diubah",
  SUBMITTED: "Diajukan ke HR Manager",
  RETURNED: "Dikembalikan ke Admin Rekrutmen",
  APPROVED: "Disetujui HR Manager",
  ACTIVATED: "Diaktifkan",
  ARCHIVED: "Diarsipkan",
};

export default async function RubricDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const hrManagerIds = (await getActiveHrManagerPositions(session.user.employeeId)).map((p) => p.positionId);
  if (!canViewAssessmentRubric(session, hrManagerIds)) return <AccessDenied />;

  const detail = await getRubricDetail(id);
  if (!detail) notFound();
  const { rubric, differences, problems } = detail;
  const status = rubric.status as RubricStatus;
  const isAdmin = canManageAssessmentRubric(session);
  const isManager = canApproveAssessmentRubric(hrManagerIds);
  const editable = isAdmin && isRubricEditable(status);

  // Names for the approval trail: the account's employee name when there is one, else its login.
  const accountIds = [...new Set([rubric.submittedByAccountId, rubric.approvedByAccountId, rubric.decidedByAccountId, rubric.activatedByAccountId, ...rubric.events.map((e) => e.actorAccountId)].filter((x): x is string => !!x))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, usernameOrEmail: true, employee: { select: { fullLegalName: true } } } });
  const nameOf = (accountId: string | null) => {
    const a = accounts.find((x) => x.id === accountId);
    return a ? (a.employee?.fullLegalName ?? a.usernameOrEmail) : "-";
  };

  const byOption = new Map(rubric.interpretations.map((i) => [i.optionId, i]));
  const diffKeys = new Set(differences.map((d) => `${d.questionNo}${d.optionKey}`));

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Pengaturan Rekrutmen", href: "/recruitment/settings" }, { label: t("assessment.rubricNav"), href: "/recruitment/assessment" }, { label: `${rubric.version.versionLabel} · ${rubric.rubricLabel}` }]} />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium text-slate-900">
              {rubric.version.name} · asesmen {rubric.version.versionLabel} · rubrik {rubric.rubricLabel}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t(`assessment.statusHelp.${status}`)}</p>
            {rubric.approvedAt && (
              <p className="mt-1 text-xs text-emerald-700">{t("assessment.approvedBy", { nama: nameOf(rubric.approvedByAccountId), tanggal: formatDateTimeMedium(rubric.approvedAt) })}</p>
            )}
            {status === "DRAFT" && rubric.decisionNote && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Dikembalikan oleh {nameOf(rubric.decidedByAccountId)}: {rubric.decisionNote}
              </p>
            )}
            {rubric.version.versionLabel === "V3.2" && (
              <p className={`mt-2 text-xs ${differences.length === 0 ? "text-emerald-700" : "font-medium text-rose-700"}`}>
                {differences.length === 0 ? t("assessment.matrixOk") : t("assessment.matrixDiff", { n: differences.length })}
              </p>
            )}
          </div>
          <StatusChip tone={RUBRIC_STATUS_TONE[status]}>{t(`assessment.statusLabel.${status}`)}</StatusChip>
        </div>

        {status === "DRAFT" && problems.length > 0 && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <p className="font-medium">{t("assessment.problemsTitle")}</p>
            <ul className="ml-4 list-disc">{problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}

        <div className="mt-4">
          <RubricSteps rubricId={rubric.id} status={status} canSubmit={isAdmin && problems.length === 0} canDecide={isManager} canActivate={isAdmin || isManager} canRevise={isAdmin} />
        </div>
      </div>

      <div className="space-y-4">
        {rubric.version.questions.map((q) => (
          <section key={q.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-medium text-slate-900">
              {q.questionCode}
              {" · "}
              <span className="text-slate-500">{t("assessment.dimension")}: {byOption.get(q.options[0].id)?.primaryDimension}</span>
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{q.scenario}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{q.prompt}</p>
            <div className="mt-3 space-y-3">
              {q.options.map((o) => {
                const i = byOption.get(o.id);
                if (!i) return null;
                return (
                  <div key={o.id} className={`rounded-lg border p-3 ${diffKeys.has(`${q.questionNo}${o.optionKey}`) ? "border-rose-300 bg-rose-50/40" : "border-slate-100 bg-slate-50/50"}`}>
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">{o.optionKey}.</span> {o.text}
                    </p>
                    {editable ? (
                      <div className="mt-2">
                        <InterpretationForm interpretationId={i.id} rubricId={rubric.id} observation={i.observation} riskSignal={i.riskSignal} />
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-start gap-3 text-sm">
                        <StatusChip tone={RISK_SIGNAL_TONE[String(i.riskSignal)]}>{i.riskSignal}</StatusChip>
                        <p className="flex-1 text-slate-700">{i.observation}</p>
                      </div>
                    )}
                    {(i.requiresControlReview || i.assessmentType === "PREFERENCE") && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {i.assessmentType === "PREFERENCE" ? "Pertanyaan preferensi kerja (netral). " : ""}
                        {i.requiresControlReview ? "Perlu ditinjau HR bila dipilih." : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">{t("assessment.history")}</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {rubric.events.map((e) => (
            <li key={e.id} className="text-slate-700">
              <span className="text-xs text-slate-400">{formatDateTimeMedium(e.createdAt)}</span> · <span className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</span> oleh {nameOf(e.actorAccountId)}
              {e.note && <span className="text-slate-500"> — {e.note}</span>}
            </li>
          ))}
        </ul>
        {rubric.sourceSha256 && <p className="mt-3 break-all text-[11px] text-slate-400">Sumber paket: SHA-256 {rubric.sourceSha256}</p>}
      </section>
    </div>
  );
}

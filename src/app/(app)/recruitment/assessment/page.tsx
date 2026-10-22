import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { RUBRIC_STATUS_TONE } from "@/lib/assessment-ui";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { formatDateTimeMedium } from "@/lib/format";
import { t } from "@/lib/i18n/id";
import { canManageAssessmentRubric, canViewAssessmentRubric } from "@/lib/permissions";
import { hasAnyAssessmentVersion, listAssessmentVersions, listRubrics } from "@/lib/recruitment-assessment-service";
import { requireSession } from "@/lib/require-session";
import { ActionForm, ConfirmAction } from "../settings/settings-forms";
import { importPackageAction, saveTimeLimitAction } from "./actions";
import { ASSESSMENT_TIME_LIMIT_MAX, ASSESSMENT_TIME_LIMIT_MIN } from "@/lib/recruitment-assessment";

export default async function AssessmentRubricsPage() {
  const session = await requireSession();
  const hrManagerIds = (await getActiveHrManagerPositions(session.user.employeeId)).map((p) => p.positionId);
  if (!canViewAssessmentRubric(session, hrManagerIds)) return <AccessDenied />;
  const canManage = canManageAssessmentRubric(session);
  const [rubrics, imported, versions] = await Promise.all([listRubrics(), hasAnyAssessmentVersion(), listAssessmentVersions()]);

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Pengaturan Rekrutmen", href: "/recruitment/settings" }, { label: t("assessment.rubricNav") }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{t("assessment.rubricTitle")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{t("assessment.rubricIntro")}</p>
      </div>

      <p className="text-sm">
        <Link href="/recruitment/assessment/results" className="font-medium text-indigo-600 hover:underline">
          Lihat hasil Tes Situasi Kerja pelamar
        </Link>
      </p>

      {!imported && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">{t("assessment.importTitle")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("assessment.importBody")}</p>
          {canManage ? (
            <div className="mt-3">
              <ConfirmAction label={t("assessment.importButton")} confirmLabel={t("assessment.actions.confirm")} action={importPackageAction} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Hanya Admin Rekrutmen yang dapat memuat paket ini.</p>
          )}
        </div>
      )}

      {versions.map((v) => (
        <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">
            {t("assessment.settings.title")} · {v.name} · {v.versionLabel}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">{t("assessment.settings.help")}</p>
          {canManage ? (
            <div className="mt-3">
              <ActionForm action={saveTimeLimitAction.bind(null, v.id)} submitLabel={t("assessment.settings.save")} className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor={`time-${v.id}`}>{t("assessment.settings.label")}</label>
                  <input
                    id={`time-${v.id}`}
                    name="minutes"
                    type="number"
                    min={ASSESSMENT_TIME_LIMIT_MIN}
                    max={ASSESSMENT_TIME_LIMIT_MAX}
                    step={1}
                    defaultValue={v.timeLimitMinutes}
                    required
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </ActionForm>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-700">{v.timeLimitMinutes} menit</p>
          )}
        </div>
      ))}

      {imported && rubrics.length === 0 && <p className="text-sm text-slate-500">{t("assessment.noRubrics")}</p>}

      <div className="space-y-3">
        {rubrics.map((r) => (
          <Link key={r.id} href={`/recruitment/assessment/${r.id}`} className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-slate-900">
                  {r.version.name} · asesmen {r.version.versionLabel} · rubrik {r.rubricLabel}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(`assessment.statusHelp.${r.status}`)} {r._count.submissions > 0 && `· dipakai ${r._count.submissions} pelamar`}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Dibuat {formatDateTimeMedium(r.createdAt)}</p>
              </div>
              <StatusChip tone={RUBRIC_STATUS_TONE[r.status]}>{t(`assessment.statusLabel.${r.status}`)}</StatusChip>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

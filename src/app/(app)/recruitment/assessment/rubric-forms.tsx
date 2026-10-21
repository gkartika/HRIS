"use client";

import { ActionForm, ConfirmAction } from "../settings/settings-forms";
import { approveRubricAction, createRevisionAction, returnRubricAction, rubricStepAction, saveInterpretationAction } from "./actions";
import { t } from "@/lib/i18n/id";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const primary = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700";
const ghost = "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";

// One answer option of a DRAFT rubric: the observation and the risk signal can be changed, then saved.
export function InterpretationForm({
  interpretationId,
  rubricId,
  observation,
  riskSignal,
}: {
  interpretationId: string;
  rubricId: string;
  observation: string;
  riskSignal: number;
}) {
  return (
    <ActionForm action={saveInterpretationAction.bind(null, interpretationId, rubricId)} submitLabel="Simpan" className="space-y-2">
      <div className="grid gap-2 md:grid-cols-[1fr_14rem]">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor={`obs-${interpretationId}`}>{t("assessment.observation")}</label>
          <textarea id={`obs-${interpretationId}`} name="observation" defaultValue={observation} rows={2} maxLength={500} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor={`sig-${interpretationId}`}>{t("assessment.riskValue")}</label>
          <select id={`sig-${interpretationId}`} name="riskSignal" defaultValue={String(riskSignal)} className={field}>
            <option value="0">0 · {t("assessment.signal.0")}</option>
            <option value="-1">-1 · {t("assessment.signal.-1")}</option>
            <option value="-2">-2 · {t("assessment.signal.-2")}</option>
          </select>
        </div>
      </div>
    </ActionForm>
  );
}

// The buttons that move a rubric along. The page shows only the ones this person may use; the server checks again.
export function RubricSteps({
  rubricId,
  status,
  canSubmit,
  canDecide,
  canActivate,
  canRevise,
}: {
  rubricId: string;
  status: string;
  canSubmit: boolean;
  canDecide: boolean;
  canActivate: boolean;
  canRevise: boolean;
}) {
  const confirm = t("assessment.actions.confirm");
  return (
    <div className="space-y-4">
      {status === "DRAFT" && canSubmit && (
        <ConfirmAction label={t("assessment.actions.submit")} confirmLabel={confirm} action={rubricStepAction.bind(null, rubricId, "SUBMIT", undefined)} className={primary} />
      )}

      {status === "PENDING_APPROVAL" && canDecide && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <ActionForm action={approveRubricAction.bind(null, rubricId)} submitLabel={t("assessment.actions.approve")}>
              <label className="block text-xs text-slate-500" htmlFor="approve-note">{t("assessment.actions.approveNote")}</label>
              <textarea id="approve-note" name="note" rows={2} className={field} />
            </ActionForm>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <ActionForm action={returnRubricAction.bind(null, rubricId)} submitLabel={t("assessment.actions.return")}>
              <label className="block text-xs text-slate-500" htmlFor="return-note">{t("assessment.actions.returnReason")}</label>
              <textarea id="return-note" name="note" rows={2} required className={field} />
            </ActionForm>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {status === "APPROVED" && canActivate && (
          <ConfirmAction label={t("assessment.actions.activate")} confirmLabel={confirm} action={rubricStepAction.bind(null, rubricId, "ACTIVATE", undefined)} className={primary} />
        )}
        {(status === "APPROVED" || status === "ACTIVE") && canActivate && (
          <ConfirmAction label={t("assessment.actions.archive")} confirmLabel={confirm} action={rubricStepAction.bind(null, rubricId, "ARCHIVE", undefined)} className={ghost} />
        )}
        {(status === "APPROVED" || status === "ACTIVE" || status === "ARCHIVED") && canRevise && (
          <ConfirmAction label={t("assessment.actions.revise")} confirmLabel={confirm} action={createRevisionAction.bind(null, rubricId)} className={ghost} />
        )}
      </div>
    </div>
  );
}

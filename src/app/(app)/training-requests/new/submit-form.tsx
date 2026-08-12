"use client";

import { useActionState, useState } from "react";
import { submitTrainingRequest } from "../actions";
import { t } from "@/lib/i18n/id";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  fullLegalName: string;
}

const REASON_KEYS = ["ONBOARDING", "COMPETENCY_GAP", "PROMOTION", "DEPARTMENT_REQUEST", "REFRESHER", "INDIVIDUAL_DEVELOPMENT"];

export function SubmitTrainingRequestForm({
  selfEmployeeId,
  departmentEmployees,
}: {
  selfEmployeeId: string;
  departmentEmployees: EmployeeOption[];
}) {
  const [error, formAction, isPending] = useActionState(submitTrainingRequest, undefined);
  const [forSelf, setForSelf] = useState(true);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      {departmentEmployees.length > 0 && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={forSelf} onChange={() => setForSelf(true)} />
            {t("trainingRequest.forSelfOption")}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!forSelf} onChange={() => setForSelf(false)} />
            {t("trainingRequest.forEmployeeOption")}
          </label>
        </div>
      )}

      {forSelf ? (
        <input type="hidden" name="employeeId" value={selfEmployeeId} />
      ) : (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.employeeLabel")}</label>
          <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih Karyawan —</option>
            {departmentEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeNumber} — {e.fullLegalName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.requestedTopicLabel")}</label>
        <input name="requestedTopic" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.reasonLabel")}</label>
        <select name="reason" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">—</option>
          {REASON_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`trainingRequest.reasonOptions.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.gapReferenceNoteLabel")}</label>
        <input name="gapReferenceNote" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.businessJustificationLabel")}</label>
        <textarea name="businessJustification" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.preferredTimingLabel")}</label>
        <input name="preferredTiming" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Mengirim..." : t("trainingRequest.submitButton")}
      </button>
    </form>
  );
}

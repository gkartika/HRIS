"use client";

import { useActionState, useState } from "react";
import { submitAbsenceRequest } from "../actions";
import { remainingEntitlementDays } from "@/lib/absence";
import { t } from "@/lib/i18n/id";
import { FieldError, FormErrorSummary, invalidClass } from "@/components/field-error";

export interface EmployeeOption {
  id: string;
  label: string;
}

export interface AbsenceTypeOption {
  code: string;
  label: string;
}

export interface AbsenceTypeQuota {
  code: string;
  quota: number | null;
  usedDays: number;
}

// Badge tone for the remaining-quota hint below the Jenis Absensi dropdown —
// same thresholds whether 0 was always the entitlement or it was used up.
function quotaToneClass(remainingDays: number, quota: number): string {
  if (remainingDays <= 0) return "border-rose-200 bg-rose-50 text-rose-700";
  if (remainingDays / quota <= 0.25) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function SubmitAbsenceForm({
  employeeId,
  employees,
  absenceTypes,
  quotaByType,
}: {
  employeeId?: string;
  employees?: EmployeeOption[];
  absenceTypes: AbsenceTypeOption[];
  quotaByType: AbsenceTypeQuota[];
}) {
  const [state, formAction, isPending] = useActionState(submitAbsenceRequest, undefined);
  const [selectedType, setSelectedType] = useState(absenceTypes[0]?.code ?? "");
  const selectedQuota = quotaByType.find((q) => q.code === selectedType);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      {employeeId ? (
        <input type="hidden" name="employeeId" value={employeeId} />
      ) : (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
          <select
            name="employeeId"
            required
            defaultValue={state?.values.employeeId ?? ""}
            className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "employeeId")}`}
          >
            <option value="">— Pilih Karyawan —</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <FieldError state={state} name="employeeId" />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.typeLabel")}</label>
          <select
            name="absenceType"
            required
            defaultValue={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={`rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "absenceType")}`}
          >
            {absenceTypes.map((tp) => (
              <option key={tp.code} value={tp.code}>
                {tp.label}
              </option>
            ))}
          </select>
          {selectedQuota?.quota != null && (
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${quotaToneClass(
                  remainingEntitlementDays(selectedQuota.quota, selectedQuota.usedDays),
                  selectedQuota.quota
                )}`}
              >
                {t("absence.remainingEntitlement", {
                  days: remainingEntitlementDays(selectedQuota.quota, selectedQuota.usedDays),
                  quota: selectedQuota.quota,
                })}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.startDateLabel")}</label>
          <input
            name="startDate"
            type="date"
            required
            defaultValue={state?.values.startDate ?? ""}
            className={`rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "startDate")}`}
          />
          <FieldError state={state} name="startDate" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.endDateLabel")}</label>
          <input
            name="endDate"
            type="date"
            required
            defaultValue={state?.values.endDate ?? ""}
            className={`rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "endDate")}`}
          />
          <FieldError state={state} name="endDate" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("absence.reasonLabel")}</label>
        <textarea
          name="reason"
          required
          rows={3}
          defaultValue={state?.values.reason ?? ""}
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${invalidClass(state, "reason")}`}
        />
        <FieldError state={state} name="reason" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("absence.attachmentLabel")}</label>
        <input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
        <FieldError state={state} name="attachment" />
      </div>

      <FormErrorSummary state={state} />

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Mengirim..." : t("absence.newRequest")}
      </button>
    </form>
  );
}

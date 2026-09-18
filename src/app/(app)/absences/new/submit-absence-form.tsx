"use client";

import { useActionState, useState } from "react";
import { submitAbsenceRequest } from "../actions";
import { remainingEntitlementDays } from "@/lib/absence";
import { t } from "@/lib/i18n/id";

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
  const [error, formAction, isPending] = useActionState(submitAbsenceRequest, undefined);
  const [selectedType, setSelectedType] = useState(absenceTypes[0]?.code ?? "");
  const selectedQuota = quotaByType.find((q) => q.code === selectedType);
  const selectedLabel = absenceTypes.find((tp) => tp.code === selectedType)?.label ?? "";

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      {employeeId ? (
        <input type="hidden" name="employeeId" value={employeeId} />
      ) : (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
          <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih Karyawan —</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
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
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {absenceTypes.map((tp) => (
              <option key={tp.code} value={tp.code}>
                {tp.label}
              </option>
            ))}
          </select>
          {selectedQuota?.quota != null && (
            <p className="mt-1 text-xs text-slate-500">
              {t("absence.remainingEntitlement", {
                type: selectedLabel,
                days: remainingEntitlementDays(selectedQuota.quota, selectedQuota.usedDays),
                quota: selectedQuota.quota,
              })}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.startDateLabel")}</label>
          <input name="startDate" type="date" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("absence.endDateLabel")}</label>
          <input name="endDate" type="date" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("absence.reasonLabel")}</label>
        <textarea name="reason" required rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("absence.attachmentLabel")}</label>
        <input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

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

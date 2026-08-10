"use client";

import { useActionState } from "react";
import { createContract } from "../actions";
import { t } from "@/lib/i18n/id";
import type { EmploymentStatus, Employee } from "@/generated/prisma/client";

const CONTRACT_TYPES: EmploymentStatus[] = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// employeeId is provided (and locked) when reached from an Employee's own
// page; when reached from the Contracts list "Buat Kontrak Baru" entry
// point, employees is provided instead so HR Admin picks who this is for.
export function CreateContractForm({
  employeeId,
  employees,
  defaultContractType,
}: {
  employeeId?: string;
  employees?: Employee[];
  defaultContractType?: EmploymentStatus;
}) {
  const [error, formAction, isPending] = useActionState(createContract, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      {employeeId ? (
        <input type="hidden" name="employeeId" value={employeeId} />
      ) : (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
          <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.preferredName ?? e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.contractType")}</label>
        <select
          name="contractType"
          required
          defaultValue={defaultContractType ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {!defaultContractType && <option value="">— Pilih —</option>}
          {CONTRACT_TYPES.map((ct) => (
            <option key={ct} value={ct}>
              {t(`employmentStatus.${ct}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.startDate")}</label>
        <input
          name="startDate"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">
          {t("contract.endDate")} <span className="text-slate-400">({t("contract.indefinite")})</span>
        </label>
        <input name="endDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("contract.newContract")}
      </button>
    </form>
  );
}

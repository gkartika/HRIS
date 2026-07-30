"use client";

import { useActionState } from "react";
import { createContract } from "../actions";
import { t } from "@/lib/i18n/id";
import type { EmploymentStatus } from "@/generated/prisma/client";

const CONTRACT_TYPES: EmploymentStatus[] = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateContractForm({
  employeeId,
  defaultContractType,
}: {
  employeeId: string;
  defaultContractType: EmploymentStatus;
}) {
  const action = createContract.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("contract.contractType")}</label>
        <select
          name="contractType"
          required
          defaultValue={defaultContractType}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
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

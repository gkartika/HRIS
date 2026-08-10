"use client";

import { useActionState } from "react";
import { setAbsenceEntitlementConfig } from "./actions";
import type { AbsenceType } from "@/generated/prisma/enums";

export function EntitlementRowForm({ absenceType, currentAnnualDays }: { absenceType: AbsenceType; currentAnnualDays: number }) {
  const action = setAbsenceEntitlementConfig.bind(null, absenceType);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="annualDays"
        type="number"
        min={0}
        defaultValue={currentAnnualDays}
        className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <span className="text-xs text-slate-400">hari/tahun</span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "..." : "Simpan"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createWorkOrderFromPlan, deactivateMaintenancePlan } from "../actions";
import { t } from "@/lib/i18n/id";
import { ConfirmButton } from "@/components/confirm-button";

export function CreateWorkOrderFromPlanForm({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createWorkOrderFromPlan.bind(null, planId), undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
      >
        Buat Work Order
      </button>
    );
  }

  return (
    <form action={formAction} className="w-64 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <select name="workType" required className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
        <option value="INTERNAL">Internal</option>
        <option value="VENDOR">Vendor</option>
      </select>
      <textarea name="checklistNotes" placeholder="Checklist / catatan" rows={2} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {isPending ? t("common.loading") : "Buat"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function DeactivatePlanButton({ planId }: { planId: string }) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    const result = await deactivateMaintenancePlan(planId);
    setIsPending(false);
    setError(result);
  };

  return (
    <div>
      <ConfirmButton label="Nonaktifkan" onConfirm={handleClick} pending={isPending} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60" />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

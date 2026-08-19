"use client";

import { useActionState } from "react";
import { createCorrectiveWorkOrderFromGaRequest } from "../actions";

export function CorrectiveSourceForm({ requestId }: { requestId: string }) {
  const [error, formAction, isPending] = useActionState(createCorrectiveWorkOrderFromGaRequest.bind(null, requestId), undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select name="workType" required className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
        <option value="INTERNAL">Internal</option>
        <option value="VENDOR">Vendor</option>
      </select>
      <input name="checklistNotes" placeholder="Checklist / catatan" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "..." : "Buat Work Order"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { setAbsenceApproverConfig } from "./actions";

export interface PositionOption {
  id: string;
  label: string;
}

export function ApproverRowForm({
  orgUnitId,
  positions,
  currentApproverPositionId,
  currentRequiresSecondStage,
}: {
  orgUnitId: string;
  positions: PositionOption[];
  currentApproverPositionId: string | null;
  currentRequiresSecondStage: boolean;
}) {
  const action = setAbsenceApproverConfig.bind(null, orgUnitId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        name="approverPositionId"
        defaultValue={currentApproverPositionId ?? ""}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">— Belum diatur —</option>
        {positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" name="requiresSecondStage" defaultChecked={currentRequiresSecondStage} />
        Teruskan ke unit induk (tahap ke-2)
      </label>
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

"use client";

import { useActionState } from "react";
import { setAbsenceApproverConfig } from "./actions";

export interface PositionOption {
  id: string;
  label: string;
}

export function ApproverRowForm({
  departmentId,
  positions,
  currentApproverPositionId,
}: {
  departmentId: string;
  positions: PositionOption[];
  currentApproverPositionId: string | null;
}) {
  const action = setAbsenceApproverConfig.bind(null, departmentId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
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

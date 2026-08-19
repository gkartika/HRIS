"use client";

import { useActionState } from "react";
import { setGaApprovalConfig } from "./actions";
import type { GaApprovalType } from "@/generated/prisma/enums";

export interface PositionOption {
  id: string;
  label: string;
}

export function ApprovalRowForm({
  approvalType,
  positions,
  currentApproverPositionId,
}: {
  approvalType: GaApprovalType;
  positions: PositionOption[];
  currentApproverPositionId: string | null;
}) {
  const action = setGaApprovalConfig.bind(null, approvalType);
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

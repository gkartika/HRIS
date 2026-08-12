"use client";

import { useActionState } from "react";
import { closeCompetencyCycle } from "../../actions";

export function CloseCycleButton({ cycleId }: { cycleId: string }) {
  const [error, formAction, isPending] = useActionState(closeCompetencyCycle.bind(null, cycleId), undefined);

  return (
    <form action={formAction}>
      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? "Menutup..." : "Tutup Siklus"}
      </button>
    </form>
  );
}

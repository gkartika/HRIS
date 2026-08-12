"use client";

import { useActionState } from "react";
import { deactivateMandatoryTrainingRule } from "./actions";

export function DeactivateRuleButton({ ruleId }: { ruleId: string }) {
  const [error, formAction, isPending] = useActionState(deactivateMandatoryTrainingRule.bind(null, ruleId), undefined);

  return (
    <form action={formAction}>
      {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={isPending} className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-60">
        {isPending ? "..." : "Nonaktifkan"}
      </button>
    </form>
  );
}

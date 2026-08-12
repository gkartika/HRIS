"use client";

import { useActionState } from "react";
import { applyMandatoryTrainingRuleAction } from "./actions";

export function ApplyRuleButton({ ruleId }: { ruleId: string }) {
  const [error, formAction, isPending] = useActionState(applyMandatoryTrainingRuleAction.bind(null, ruleId), undefined);

  return (
    <form action={formAction}>
      {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={isPending} className="text-xs text-indigo-600 hover:underline disabled:opacity-60">
        {isPending ? "Menerapkan..." : "Terapkan"}
      </button>
    </form>
  );
}

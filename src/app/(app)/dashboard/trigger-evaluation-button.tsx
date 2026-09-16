"use client";

import { useState, useTransition } from "react";
import { triggerRenewalCaseNow } from "../contracts/renewal-actions";

export function TriggerEvaluationButton({ contractId }: { contractId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await triggerRenewalCaseNow(contractId);
            setError(result);
          })
        }
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Memproses..." : "Mulai Evaluasi"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

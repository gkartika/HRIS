"use client";

import { useState, useTransition } from "react";
import { markBpjsDoneAction } from "../bpjs/actions";

// "Sudah" on a BPJS reminder of the Admin SDM Beranda. The row disappears when the page refreshes.
export function BpjsDoneButton({ taskKey, label }: { taskKey: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markBpjsDoneAction(taskKey);
            setError(result.error);
          })
        }
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : label}
      </button>
      {error && <p className="mt-1 max-w-48 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

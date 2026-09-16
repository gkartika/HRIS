"use client";

import { useActionState } from "react";
import { toggleExitClearanceQuestion } from "./actions";

export function ToggleActiveForm({ questionId, currentActive }: { questionId: string; currentActive: boolean }) {
  const action = toggleExitClearanceQuestion.bind(null, questionId);
  const [, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="activeFlag" value={currentActive ? "" : "on"} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-indigo-600 hover:underline disabled:opacity-60"
      >
        {currentActive ? "Nonaktifkan" : "Aktifkan"}
      </button>
    </form>
  );
}

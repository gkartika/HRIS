"use client";

import { useActionState } from "react";
import { toggleEducationLevel } from "./actions";

export function ToggleActiveForm({ levelId, currentActive }: { levelId: string; currentActive: boolean }) {
  const action = toggleEducationLevel.bind(null, levelId);
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

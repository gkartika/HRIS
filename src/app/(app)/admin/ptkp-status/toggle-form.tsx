"use client";

import { useActionState } from "react";
import { togglePtkpStatus } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";

export function ToggleActiveForm({ statusId, currentActive }: { statusId: string; currentActive: boolean }) {
  const action = togglePtkpStatus.bind(null, statusId);
  const [, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="activeFlag" value={currentActive ? "" : "on"} />
      {currentActive ? (
        <ConfirmButton label="Nonaktifkan" pending={isPending} className="text-xs text-indigo-600 hover:underline disabled:opacity-60" />
      ) : (
        <button type="submit" disabled={isPending} className="text-xs text-indigo-600 hover:underline disabled:opacity-60">
          Aktifkan
        </button>
      )}
    </form>
  );
}

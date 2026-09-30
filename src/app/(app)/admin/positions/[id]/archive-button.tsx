"use client";

import { useActionState } from "react";
import { archivePosition, unarchivePosition } from "../actions";
import { ConfirmButton } from "@/components/confirm-button";

export function ArchivePositionButton({ positionId, archived }: { positionId: string; archived: boolean }) {
  const action = (archived ? unarchivePosition : archivePosition).bind(null, positionId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      {archived ? (
        <button
          type="submit"
          disabled={isPending}
          className="text-xs text-indigo-600 hover:underline disabled:opacity-60"
        >
          {isPending ? "…" : "Aktifkan Kembali"}
        </button>
      ) : (
        <ConfirmButton
          label="Arsipkan"
          confirmLabel="Ya, arsipkan"
          pending={isPending}
          className="text-xs text-rose-600 hover:underline"
        />
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  );
}

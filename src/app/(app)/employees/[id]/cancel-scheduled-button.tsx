"use client";

import { useActionState } from "react";
import { cancelScheduledPlacement } from "./assignment-actions";
import { ConfirmButton } from "@/components/confirm-button";

// Calls off a move that has not taken effect yet. Shown to Admin SDM only; the
// server action checks the permission and the status again.
export function CancelScheduledPlacementButton({
  assignmentId,
  employeeId,
}: {
  assignmentId: string;
  employeeId: string;
}) {
  const action = cancelScheduledPlacement.bind(null, assignmentId, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-1 flex items-center gap-2">
      <ConfirmButton
        label="Batalkan jadwal"
        confirmLabel="Ya, batalkan"
        pending={isPending}
        className="text-xs text-rose-600 hover:underline"
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  );
}

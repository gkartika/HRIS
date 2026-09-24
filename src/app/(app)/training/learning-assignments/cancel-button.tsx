"use client";

import { useActionState } from "react";
import { cancelLearningAssignment } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";

export function CancelButton({ assignmentId }: { assignmentId: string }) {
  const [error, formAction, isPending] = useActionState(cancelLearningAssignment.bind(null, assignmentId), undefined);

  return (
    <form action={formAction} className="ml-3 inline-block">
      {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
      <ConfirmButton label="Batalkan" confirmLabel="Ya, batalkan" pending={isPending} className="text-xs text-rose-600 hover:underline disabled:opacity-60" />
    </form>
  );
}

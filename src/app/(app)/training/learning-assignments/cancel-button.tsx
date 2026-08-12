"use client";

import { useActionState } from "react";
import { cancelLearningAssignment } from "./actions";

export function CancelButton({ assignmentId }: { assignmentId: string }) {
  const [error, formAction, isPending] = useActionState(cancelLearningAssignment.bind(null, assignmentId), undefined);

  return (
    <form action={formAction} className="ml-3 inline-block">
      {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={isPending} className="text-xs text-rose-600 hover:underline disabled:opacity-60">
        {isPending ? "..." : "Batalkan"}
      </button>
    </form>
  );
}

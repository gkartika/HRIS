"use client";

import { useActionState } from "react";
import { confirmLearningAssignmentAttendance } from "./actions";

export function ConfirmAttendanceButton({ assignmentId }: { assignmentId: string }) {
  const [error, formAction, isPending] = useActionState(confirmLearningAssignmentAttendance.bind(null, assignmentId), undefined);

  return (
    <form action={formAction} className="inline-block">
      {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={isPending} className="text-xs text-indigo-600 hover:underline disabled:opacity-60">
        {isPending ? "..." : "Konfirmasi Hadir"}
      </button>
    </form>
  );
}

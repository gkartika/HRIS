"use client";

import { useTransition } from "react";
import { markCourseMaterialComplete } from "../actions";

export function MarkMaterialButton({
  assignmentId,
  materialId,
  completed,
  editable,
}: {
  assignmentId: string;
  materialId: string;
  completed: boolean;
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (completed) {
    return <span className="text-xs font-medium text-emerald-700">Selesai ✓</span>;
  }

  // markCourseMaterialComplete already rejects this server-side once the
  // assignment leaves ASSIGNED — hiding the button too avoids an active-
  // looking control that silently no-ops.
  if (!editable) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => markCourseMaterialComplete(assignmentId, materialId))}
      className="text-xs text-indigo-600 hover:underline disabled:opacity-60"
    >
      {isPending ? "..." : "Tandai Selesai"}
    </button>
  );
}

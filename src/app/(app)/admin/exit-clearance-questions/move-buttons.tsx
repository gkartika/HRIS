"use client";

import { useTransition } from "react";
import { moveExitClearanceQuestion } from "./actions";

export function MoveButtons({
  questionId,
  canMoveUp,
  canMoveDown,
}: {
  questionId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        disabled={!canMoveUp || isPending}
        onClick={() => startTransition(() => moveExitClearanceQuestion(questionId, "up"))}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={!canMoveDown || isPending}
        onClick={() => startTransition(() => moveExitClearanceQuestion(questionId, "down"))}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}

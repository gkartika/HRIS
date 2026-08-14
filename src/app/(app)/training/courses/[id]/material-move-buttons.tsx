"use client";

import { useTransition } from "react";
import { moveCourseMaterial } from "../actions";

export function MaterialMoveButtons({ materialId, canMoveUp, canMoveDown }: { materialId: string; canMoveUp: boolean; canMoveDown: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        disabled={!canMoveUp || isPending}
        onClick={() => startTransition(() => moveCourseMaterial(materialId, "up"))}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={!canMoveDown || isPending}
        onClick={() => startTransition(() => moveCourseMaterial(materialId, "down"))}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { publishTrainingCourse, archiveTrainingCourse } from "../actions";
import { ConfirmButton } from "@/components/confirm-button";

export function PublishArchiveButtons({ courseId, canPublish, canArchive }: { courseId: string; canPublish: boolean; canArchive: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (!canPublish && !canArchive) return null;

  return (
    <div className="flex gap-2">
      {canPublish && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => publishTrainingCourse(courseId))}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Publikasikan
        </button>
      )}
      {canArchive && (
        <ConfirmButton label="Arsipkan" onConfirm={() => startTransition(() => archiveTrainingCourse(courseId))} pending={isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60" />
      )}
    </div>
  );
}

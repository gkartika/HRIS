"use client";

import { useActionState, useState } from "react";
import { completeLearningAssignment } from "./actions";

export function CompleteForm({ assignmentId, certificateRequired }: { assignmentId: string; certificateRequired: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(completeLearningAssignment.bind(null, assignmentId), undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-indigo-600 hover:underline">
        Tandai Selesai
      </button>
    );
  }

  return (
    <form action={formAction} className="w-56 space-y-2 text-left">
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {certificateRequired && (
        <>
          <input name="certificateNumber" placeholder="No. Sertifikat" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
          <input name="certificateIssueDate" type="date" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
        </>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "..." : "Simpan"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </form>
  );
}

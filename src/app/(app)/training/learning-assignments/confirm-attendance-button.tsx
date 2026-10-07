"use client";

import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState, useState } from "react";
import { confirmLearningAssignmentAttendance } from "./actions";

export function ConfirmAttendanceButton({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(confirmLearningAssignmentAttendance.bind(null, assignmentId), undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-indigo-600 hover:underline">
        Konfirmasi Hadir
      </button>
    );
  }

  return (
    <form action={formAction} className="w-56 space-y-2 text-left">
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <input
        name="attendanceEvidenceNote"
        placeholder="Catatan bukti kehadiran (opsional)"
        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
      />
      <DocumentFileInput name="attendanceEvidenceFile" accept="application/pdf,image/jpeg,image/png" className="w-full text-xs" />
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

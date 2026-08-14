"use client";

import { useActionState, useState } from "react";
import { completeLearningAssignment } from "./actions";

export function CompleteForm({
  assignmentId,
  certificateRequired,
  ready = true,
}: {
  assignmentId: string;
  certificateRequired: boolean;
  ready?: boolean;
}) {
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
      {!ready && <p className="text-xs text-amber-600">Karyawan belum menyelesaikan materi wajib/kuis — dapat gagal disimpan.</p>}
      {certificateRequired && (
        <>
          <input name="certificateNumber" placeholder="No. Sertifikat" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
          <label className="block text-[11px] text-slate-500">Tanggal Terbit</label>
          <input name="certificateIssueDate" type="date" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
          <label className="block text-[11px] text-slate-500">Tanggal Kedaluwarsa (opsional)</label>
          <input name="certificateExpiryDate" type="date" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" />
          <label className="block text-[11px] text-slate-500">Berkas Sertifikat (opsional)</label>
          <input name="certificateFile" type="file" accept="application/pdf,image/jpeg,image/png" className="w-full text-xs" />
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

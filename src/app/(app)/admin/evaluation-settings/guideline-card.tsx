"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { removeGuidelineAction, uploadGuidelineAction } from "./actions";

export interface GuidelineInfo {
  fileName: string;
  sizeLabel: string;
  uploadedLabel: string;
}

function PdfBadge() {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-100 text-[11px] font-bold text-rose-700">PDF</span>;
}

// The PDF guideline evaluators can open from the form. Upload, replace or remove; the file is checked on the server.
export function GuidelineCard({ guideline }: { guideline: GuidelineInfo | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, formAction, isUploading] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await uploadGuidelineAction(prev, fd);
    if (!result) {
      formRef.current?.reset();
      setFileName(null);
    }
    return result;
  }, undefined);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Pedoman penilaian (PDF)</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Satu file PDF berisi standar nilai tiap kriteria. Evaluator melihat kartu &quot;Pedoman penilaian&quot; di form dan membukanya di tab baru.
      </p>

      {guideline ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <PdfBadge />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{guideline.fileName}</p>
            <p className="text-xs text-slate-500">
              {guideline.sizeLabel} · {guideline.uploadedLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/evaluation-guideline" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Lihat
            </a>
            <ConfirmButton
              label="Hapus"
              confirmLabel="Ya, hapus"
              pending={removing}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
              onConfirm={() =>
                startRemove(async () => {
                  setRemoveError(null);
                  const message = await removeGuidelineAction();
                  if (message) setRemoveError(message);
                })
              }
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <p className="text-sm font-semibold text-slate-800">Belum ada pedoman</p>
          <p className="mt-0.5 text-xs text-slate-500">Hanya file PDF, maksimal 4 MB.</p>
        </div>
      )}

      <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {guideline ? "Pilih file pengganti" : "Pilih file PDF"}
          <input name="file" type="file" accept="application/pdf,.pdf" required className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
        </label>
        {fileName && <span className="min-w-0 max-w-full truncate text-sm text-slate-600">{fileName}</span>}
        <button type="submit" disabled={isUploading || !fileName} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {isUploading ? "Mengunggah..." : guideline ? "Ganti pedoman" : "Unggah pedoman"}
        </button>
      </form>
      {(error || removeError) && <p role="alert" className="mt-2 text-xs text-rose-600">{error ?? removeError}</p>}
    </section>
  );
}

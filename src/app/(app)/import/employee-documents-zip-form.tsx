"use client";

import { useActionState } from "react";
import { Download } from "lucide-react";
import { uploadEmployeeDocumentsZip } from "./actions";

export function EmployeeDocumentsZipForm() {
  const [message, formAction, isPending] = useActionState(uploadEmployeeDocumentsZip, undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-900">Dokumen Karyawan (ZIP + Manifest)</h3>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download endpoint, not a page route */}
        <a
          href="/api/import-export/export/employee-documents"
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          <Download size={12} /> Ekspor ZIP
        </a>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Ekspor semua dokumen karyawan (KTP, KK, dan lainnya) sebagai satu berkas ZIP berisi
        manifest.csv. Impor ZIP untuk mengunggah banyak dokumen sekaligus.
      </p>
      <form action={formAction} className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".zip"
          required
          className="flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Memproses..." : "Impor ZIP"}
        </button>
      </form>
      {message && <p className="mt-2 text-xs text-amber-700">{message}</p>}
    </div>
  );
}

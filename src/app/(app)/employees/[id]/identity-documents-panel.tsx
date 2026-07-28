"use client";

import { useActionState } from "react";
import { uploadIdentityDocument } from "./document-actions";

interface DocSlotProps {
  employeeId: string;
  category: "KTP" | "KK";
  label: string;
  currentFile: { id: string; originalFileName: string } | null;
  canUpload: boolean;
}

function DocumentSlot({ employeeId, category, label, currentFile, canUpload }: DocSlotProps) {
  const action = uploadIdentityDocument.bind(null, employeeId, category);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {currentFile ? (
        <a
          href={`/api/files/${currentFile.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block text-xs text-indigo-600 hover:underline"
        >
          {currentFile.originalFileName}
        </a>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Belum diunggah</p>
      )}
      {canUpload && (
        <form action={formAction} className="mt-3 flex items-center gap-2">
          <input
            type="file"
            name="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            required
            className="flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
          />
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPending ? "..." : currentFile ? "Ganti" : "Unggah"}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <p className="mt-2 text-[11px] text-slate-400">PDF, JPG, JPEG, atau PNG — maksimum 10 MB.</p>
    </div>
  );
}

export function IdentityDocumentsPanel({
  employeeId,
  ktpFile,
  kkFile,
  canUpload,
}: {
  employeeId: string;
  ktpFile: { id: string; originalFileName: string } | null;
  kkFile: { id: string; originalFileName: string } | null;
  canUpload: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-medium text-slate-900">Dokumen Identitas</h2>
      <p className="mt-1 text-xs text-slate-500">
        Tersimpan privat — hanya dapat diakses oleh karyawan yang bersangkutan dan Admin SDM.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <DocumentSlot
          employeeId={employeeId}
          category="KTP"
          label="File KTP"
          currentFile={ktpFile}
          canUpload={canUpload}
        />
        <DocumentSlot
          employeeId={employeeId}
          category="KK"
          label="File KK"
          currentFile={kkFile}
          canUpload={canUpload}
        />
      </div>
    </div>
  );
}

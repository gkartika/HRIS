"use client";

import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState } from "react";
import { uploadBpjsCard } from "./bpjs-actions";

interface DocSlotProps {
  employeeId: string;
  category: "BPJS_TK" | "BPJS_KESEHATAN";
  label: string;
  currentFile: { id: string; originalFileName: string } | null;
  canUpload: boolean;
}

function DocumentSlot({ employeeId, category, label, currentFile, canUpload }: DocSlotProps) {
  const action = uploadBpjsCard.bind(null, employeeId, category);
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
          <DocumentFileInput
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
      <p className="mt-2 text-[11px] text-slate-400">PDF, JPG, JPEG, atau PNG — maksimum 4 MB (foto besar diperkecil otomatis).</p>
    </div>
  );
}

export function BpjsCardsPanel({
  employeeId,
  bpjsTkFile,
  bpjsKesehatanFile,
  canUpload,
}: {
  employeeId: string;
  bpjsTkFile: { id: string; originalFileName: string } | null;
  bpjsKesehatanFile: { id: string; originalFileName: string } | null;
  canUpload: boolean;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-slate-900">Kartu BPJS</h2>
      <p className="mt-1 text-xs text-slate-500">
        Dapat diunduh oleh karyawan yang bersangkutan, Admin SDM, Admin GA, dan Admin Pelatihan.
        Hanya Admin SDM yang dapat mengunggah atau mengganti berkas.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <DocumentSlot
          employeeId={employeeId}
          category="BPJS_TK"
          label="Kartu BPJS Ketenagakerjaan"
          currentFile={bpjsTkFile}
          canUpload={canUpload}
        />
        <DocumentSlot
          employeeId={employeeId}
          category="BPJS_KESEHATAN"
          label="Kartu BPJS Kesehatan"
          currentFile={bpjsKesehatanFile}
          canUpload={canUpload}
        />
      </div>
    </div>
  );
}

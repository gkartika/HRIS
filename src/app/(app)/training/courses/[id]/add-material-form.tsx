"use client";

import { useActionState, useState } from "react";
import { addCourseMaterial } from "../actions";

const FILE_ACCEPT: Record<string, string> = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function AddMaterialForm({ courseId }: { courseId: string }) {
  const [error, formAction, isPending] = useActionState(addCourseMaterial.bind(null, courseId), undefined);
  const [materialType, setMaterialType] = useState("PDF");
  const isFileBacked = materialType === "PDF" || materialType === "DOCX" || materialType === "PPTX";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
      {error && <p className="md:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Judul Materi</label>
        <input name="title" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Materi</label>
        <select
          name="materialType"
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="PDF">PDF</option>
          <option value="DOCX">DOCX</option>
          <option value="PPTX">PPTX</option>
          <option value="VIDEO">Video (tautan)</option>
          <option value="URL">Tautan Eksternal</option>
        </select>
      </div>
      {isFileBacked ? (
        <div>
          <label className="mb-1 block text-xs text-slate-500">Berkas</label>
          <input
            name="file"
            type="file"
            accept={FILE_ACCEPT[materialType]}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tautan (URL)</label>
          <input
            name="externalUrl"
            type="url"
            placeholder="https://..."
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      )}
      <div className="flex items-end gap-2">
        <input id="isRequired" name="isRequired" type="checkbox" defaultChecked />
        <label htmlFor="isRequired" className="text-xs text-slate-600">
          Wajib untuk kelulusan
        </label>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Materi"}
        </button>
      </div>
    </form>
  );
}

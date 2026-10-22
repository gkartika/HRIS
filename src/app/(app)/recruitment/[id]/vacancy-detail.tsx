"use client";

import { saveVacancyDetailAction } from "../request-changes-actions";
import { useKeptForm } from "./job-and-manage";
import { t } from "@/lib/i18n/id";

const FIELD = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

// What applicants read on the vacancy, written by Admin Rekrutmen / Admin SDM. The request's own job description
// and criteria are internal and only shown here as a reference for the writer.
export function VacancyDetailCard({
  requestId,
  jobTitle,
  saved,
  internalDescription,
  internalCriteria,
}: {
  requestId: string;
  jobTitle: string;
  saved: { title: string | null; description: string | null; requirements: string | null };
  internalDescription: string;
  internalCriteria: string | null;
}) {
  const [error, submit, pending] = useKeptForm(saveVacancyDetailAction.bind(null, requestId));
  const written = !!saved.description?.trim();

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <h3 className="text-sm font-semibold text-slate-900">
        Detail lowongan {!written && <span className="ml-1 text-xs font-normal text-amber-700">belum ditulis</span>}
      </h3>
      <p className="mt-1 text-xs text-slate-600">Inilah yang dibaca pelamar. Deskripsi dan kriteria di permintaan hanya untuk internal dan tidak ikut tampil.</p>
      <form onSubmit={submit} className="mt-3 grid gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Judul lowongan</label>
          <input name="publicTitle" type="text" maxLength={120} defaultValue={saved.title ?? ""} placeholder={jobTitle} className={FIELD} />
          <p className="mt-1 text-xs text-slate-400">Boleh dikosongkan: memakai nama jabatan ({jobTitle}).</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tentang pekerjaan</label>
          <textarea name="publicDescription" rows={4} required maxLength={4000} defaultValue={saved.description ?? ""} className={FIELD} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Persyaratan</label>
          <textarea name="publicRequirements" rows={4} maxLength={4000} defaultValue={saved.requirements ?? ""} className={FIELD} />
        </div>
        <details className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">Lihat teks dari permintaan (internal, untuk acuan)</summary>
          <p className="mt-2 whitespace-pre-line">Deskripsi: {internalDescription}</p>
          {internalCriteria && <p className="mt-1 whitespace-pre-line">Kriteria khusus: {internalCriteria}</p>}
        </details>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div>
          <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {pending ? t("common.loading") : "Simpan detail"}
          </button>
        </div>
      </form>
    </div>
  );
}

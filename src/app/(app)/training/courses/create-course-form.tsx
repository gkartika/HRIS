"use client";

import { useActionState } from "react";
import { createTrainingCourse } from "./actions";

export function CreateCourseForm() {
  const [error, formAction, isPending] = useActionState(createTrainingCourse, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3">
      {error && <p className="md:col-span-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Judul Pelatihan</label>
        <input name="title" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kategori</label>
        <input name="category" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Penyelenggara</label>
        <input name="provider" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Metode Penyampaian</label>
        <input name="deliveryMethod" placeholder="Tatap Muka / Daring" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Mode Pelatihan</label>
        <select name="mode" defaultValue="ONLINE" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="ONLINE">Daring (Online)</option>
          <option value="IN_PERSON">Tatap Muka (In-person)</option>
          <option value="BLENDED">Campuran (Blended)</option>
        </select>
      </div>
      <div className="md:col-span-3">
        <label className="mb-1 block text-xs text-slate-500">Tujuan Pembelajaran</label>
        <textarea name="objectives" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Estimasi Biaya</label>
        <input name="plannedCost" type="number" step="0.01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Interval Efektivitas (hari)</label>
        <input
          name="effectivenessFollowupDays"
          type="number"
          defaultValue={30}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <input id="certificateRequired" name="certificateRequired" type="checkbox" />
        <label htmlFor="certificateRequired" className="text-xs text-slate-600">
          Ada Sertifikat
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input id="effectivenessRequired" name="effectivenessRequired" type="checkbox" />
        <label htmlFor="effectivenessRequired" className="text-xs text-slate-600">
          Perlu Evaluasi Efektivitas
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input id="isOnboardingRequired" name="isOnboardingRequired" type="checkbox" />
        <label htmlFor="isOnboardingRequired" className="text-xs text-slate-600">
          Wajib untuk Onboarding
        </label>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Pelatihan"}
        </button>
      </div>
    </form>
  );
}

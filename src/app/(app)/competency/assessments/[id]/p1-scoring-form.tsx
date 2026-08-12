"use client";

import { useActionState } from "react";
import { submitP1Assessment } from "../../actions";
import { t } from "@/lib/i18n/id";
import { COMPANY_VALUE_SCORE_SCALE } from "@/lib/competency";

interface ItemRow {
  id: string;
  competencyNameSnapshot: string;
  categorySnapshot: string;
  requiredLevel: number | null;
}

interface ValueRow {
  id: string;
  valueNameSnapshot: string;
  weightSnapshot: number;
}

const LEVELS = [0, 1, 2, 3, 4, 5];

export function P1ScoringForm({
  assessmentId,
  items,
  valueItems,
}: {
  assessmentId: string;
  items: ItemRow[];
  valueItems: ValueRow[];
}) {
  const [error, formAction, isPending] = useActionState(submitP1Assessment.bind(null, assessmentId), undefined);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">Kompetensi (Posisi Utama) — Isi Level Aktual</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Kompetensi</th>
              <th className="px-4 py-2 font-medium">Kategori</th>
              <th className="px-4 py-2 font-medium">Level Disyaratkan</th>
              <th className="px-4 py-2 font-medium">Level Aktual (0-5)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">{item.competencyNameSnapshot}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{t(`competencyCategory.${item.categorySnapshot}`)}</td>
                <td className="px-4 py-2 text-slate-600">{item.requiredLevel ?? "N/A"}</td>
                <td className="px-4 py-2">
                  <select name={`actual_${item.id}`} required defaultValue="" className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
                    <option value="" disabled>
                      —
                    </option>
                    {LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-xs text-slate-400">
                  Tidak ada kompetensi wajib yang dikonfigurasi untuk Jabatan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">Tata Nilai Perusahaan</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nilai</th>
              <th className="px-4 py-2 font-medium">Bobot</th>
              <th className="px-4 py-2 font-medium">Skor P1</th>
            </tr>
          </thead>
          <tbody>
            {valueItems.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">{v.valueNameSnapshot}</td>
                <td className="px-4 py-2 text-slate-600">{v.weightSnapshot}%</td>
                <td className="px-4 py-2">
                  <select name={`p1score_${v.id}`} required defaultValue="" className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
                    <option value="" disabled>
                      —
                    </option>
                    {COMPANY_VALUE_SCORE_SCALE.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Mengirim..." : "Kirim Penilaian P1"}
      </button>
    </form>
  );
}

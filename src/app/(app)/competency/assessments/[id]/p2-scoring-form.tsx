"use client";

import { useActionState } from "react";
import { submitP2Assessment } from "../../actions";
import { COMPANY_VALUE_SCORE_SCALE } from "@/lib/competency";

interface ValueRow {
  id: string;
  valueNameSnapshot: string;
  weightSnapshot: number;
}

export function P2ScoringForm({ assessmentId, valueItems }: { assessmentId: string; valueItems: ValueRow[] }) {
  const [error, formAction, isPending] = useActionState(submitP2Assessment.bind(null, assessmentId), undefined);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">Tata Nilai Perusahaan — Isi Skor P2</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nilai</th>
              <th className="px-4 py-2 font-medium">Bobot</th>
              <th className="px-4 py-2 font-medium">Skor P2</th>
            </tr>
          </thead>
          <tbody>
            {valueItems.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">{v.valueNameSnapshot}</td>
                <td className="px-4 py-2 text-slate-600">{v.weightSnapshot}%</td>
                <td className="px-4 py-2">
                  <select name={`p2score_${v.id}`} required defaultValue="" className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
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
        {isPending ? "Mengirim..." : "Kirim Penilaian P2"}
      </button>
    </form>
  );
}

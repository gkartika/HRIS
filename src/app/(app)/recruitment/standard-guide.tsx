"use client";

import { useState } from "react";
import Link from "next/link";
import { SCORE_LABEL } from "@/lib/interview-matrix";
import type { GuideData } from "@/lib/interview-standard-queries";

// "Buka panduan lengkap": the whole matrix in a panel at the side of the form (full screen on a phone), so the scorer can read
// it without leaving the form.
export function StandardGuideButton({ guide }: { guide: GuideData }) {
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState<string | null>(null);
  const aspects = guide.aspects.filter((a) => !only || a.id === only);
  const meta = [
    guide.header.docNumber && `No. Dokumen: ${guide.header.docNumber}`,
    guide.header.revision && `No. Revisi: ${guide.header.revision}`,
    guide.header.effectiveDate && `Tgl Berlaku: ${guide.header.effectiveDate}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
        Buka panduan lengkap
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Panduan penilaian" onClick={() => setOpen(false)}>
          <aside className="h-full w-full overflow-y-auto bg-white p-5 shadow-xl sm:max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PT Cahaya Bukit Perunggu</p>
                <h2 className="text-base font-semibold text-slate-900">Matriks Penilaian Hasil Wawancara Calon Tenaga Kerja</h2>
                {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                Tutup
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <button type="button" onClick={() => setOnly(null)} className={`rounded-full border px-3 py-1 ${only === null ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                Semua aspek
              </button>
              {guide.aspects.map((a) => (
                <button key={a.id} type="button" onClick={() => setOnly(a.id)} className={`rounded-full border px-3 py-1 ${only === a.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {aspects.map((a) => (
                <section key={a.id} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {a.label}
                    {a.optional && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">opsional</span>}
                  </h3>
                  {a.standard?.definition && <p className="mt-0.5 text-xs text-slate-500">{a.standard.definition}</p>}
                  {a.standard?.note && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{a.standard.note}</p>}
                  <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                    {a.standard?.levels.map((l) => (
                      <div key={l.score} className="flex gap-3 p-3">
                        <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-sm font-semibold tabular-nums text-slate-800">{l.score}</span>
                        <span>
                          <span className="block text-xs font-semibold text-slate-700">{SCORE_LABEL[l.score]}</span>
                          <span className="text-slate-700">{l.description}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Setiap penilai memilih satu skor (2, 4, 6, 8 atau 10) pada tiap aspek.</span>
              <Link href="/recruitment/standar-penilaian" target="_blank" className="font-medium text-indigo-600 hover:underline">
                Buka sebagai halaman untuk dicetak →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

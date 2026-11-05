"use client";

import { useState } from "react";
import Link from "next/link";
import { PERFORMANCE_GRADE_NAME, type MatrixCriterion, type MatrixDefinition } from "@/lib/evaluation";
import { textLines } from "@/lib/evaluation-standard";
import type { EvaluationGuide, GuideCriterion } from "@/lib/evaluation-standard-queries";

export type GuideHeader = EvaluationGuide["header"];

// The guide an evaluator reads is the copy that was released with the evaluation (every version of every criterion), so a
// later edit in Pengaturan Evaluasi never changes what a running evaluation is judged by.
export function guideFromDefinition(definition: MatrixDefinition, header: GuideHeader): EvaluationGuide {
  const of = (list: MatrixCriterion[]): GuideCriterion[] =>
    list.flatMap((c) =>
      c.standard
        ? [{ key: c.key, label: c.label, definition: c.standard.definition, note: c.standard.note, variants: c.standard.variants.map((v) => ({ key: v.key, label: v.label, levels: [...v.levels].sort((a, b) => a.score - b.score) })) }]
        : []
    );
  return { header, performance: of(definition.performance), tataNilai: of(definition.tataNilai) };
}

function Lines({ text }: { text: string }) {
  const lines = textLines(text);
  if (lines.length <= 1) return <>{lines[0] ?? ""}</>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function CriterionBlock({ c, names }: { c: GuideCriterion; names: boolean }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{c.label}</h4>
      {c.definition && <p className="mt-0.5 text-xs text-slate-500">{c.definition}</p>}
      {c.note && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{c.note}</p>}
      {c.variants.map((v) => (
        <div key={v.key} className="mt-3">
          {v.label && <p className="text-xs font-semibold text-indigo-700">{v.label}</p>}
          <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            {[...v.levels].reverse().map((l) => (
              <div key={l.score} className="flex gap-3 p-3">
                <span className="grid h-8 min-w-10 shrink-0 place-items-center rounded-md bg-slate-100 px-1 text-sm font-semibold tabular-nums text-slate-800">{l.score}</span>
                <span className="min-w-0 text-slate-700">
                  {names && PERFORMANCE_GRADE_NAME[l.score] && <span className="block text-xs font-semibold text-slate-700">{PERFORMANCE_GRADE_NAME[l.score]}</span>}
                  <Lines text={l.description} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// "Buka panduan lengkap": the whole matrix in a panel beside the evaluation form (full screen on a phone).
export function EvaluationGuideButton({ guide }: { guide: EvaluationGuide }) {
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState<string | null>(null);
  const all = [...guide.performance.map((c) => ({ c, names: true })), ...guide.tataNilai.map((c) => ({ c, names: false }))];
  const shown = all.filter((x) => !only || x.c.key === only);
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
                <h3 className="text-base font-semibold text-slate-900">Matriks Evaluasi Kinerja Karyawan</h3>
                {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                Tutup
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <button type="button" onClick={() => setOnly(null)} className={`rounded-full border px-3 py-1 ${only === null ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                Semua kriteria
              </button>
              {all.map(({ c }) => (
                <button key={c.key} type="button" onClick={() => setOnly(c.key)} className={`rounded-full border px-3 py-1 ${only === c.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {shown.map(({ c, names }) => (
                <CriterionBlock key={c.key} c={c} names={names} />
              ))}
            </div>
            <div className="mt-4 text-right text-xs">
              <Link href="/evaluations/standar-penilaian" target="_blank" className="font-medium text-indigo-600 hover:underline">
                Buka sebagai halaman untuk dicetak →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

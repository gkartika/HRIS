"use client";

import { useState } from "react";
import { SCORE_LABEL, SCORE_STEPS } from "@/lib/interview-matrix";
import type { AspectStandard } from "@/lib/interview-standard";
import type { GuideData } from "@/lib/interview-standard-queries";
import { StandardGuideButton } from "./standard-guide";

export interface MatrixAspectInfo {
  id: string;
  label: string;
  /** May be left empty; shows "opsional" and can be cleared by pressing the chosen number again. */
  optional?: boolean;
  /** Shown as a small tag, e.g. "khusus HR". */
  tag?: string;
  /** What the aspect means and what each score means; without it the aspect is a plain row. */
  standard?: AspectStandard | null;
}

const BUTTON = "h-9 w-10 rounded-lg border text-sm font-semibold tabular-nums";

// The score matrix used by the HR form and the interviewer form. Every aspect with a standard is a card: its definition, the
// scores 2 / 4 / 6 / 8 / 10, and the meaning of the score pointed at or chosen. "Bandingkan semua nilai" lists all five
// meanings. Sends a hidden field score_<aspectId> for every aspect that has a score.
export function ScoreMatrix({
  aspects,
  scores,
  onChange,
  guide,
}: {
  aspects: MatrixAspectInfo[];
  scores: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  guide?: GuideData | null;
}) {
  const [hover, setHover] = useState<{ id: string; score: number } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const choose = (a: MatrixAspectInfo, n: number) => {
    const next = { ...scores };
    if (scores[a.id] === n && a.optional) delete next[a.id];
    else next[a.id] = n;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>
          {SCORE_STEPS.map((n, i) => (
            <span key={n}>
              {i > 0 && " · "}
              <b className="tabular-nums text-slate-800">{n}</b> {SCORE_LABEL[n].toLowerCase()}
            </span>
          ))}
        </span>
        {guide && guide.aspects.length > 0 && <StandardGuideButton guide={guide} />}
      </div>

      {aspects.map((a, index) => {
        const standard = a.standard ?? null;
        const buttons = (
          <div className="grid grid-cols-5 gap-1.5 sm:flex" role="group" aria-label={a.label}>
            {SCORE_STEPS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={scores[a.id] === n}
                title={SCORE_LABEL[n]}
                onClick={() => choose(a, n)}
                onMouseEnter={() => setHover({ id: a.id, score: n })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ id: a.id, score: n })}
                onBlur={() => setHover(null)}
                className={`${BUTTON} ${scores[a.id] === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}
              >
                {n}
              </button>
            ))}
          </div>
        );
        const hidden = scores[a.id] !== undefined && <input type="hidden" name={`score_${a.id}`} value={scores[a.id]} />;
        const badges = (
          <>
            {a.optional && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">opsional</span>}
            {a.tag && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{a.tag}</span>}
          </>
        );

        if (!standard) {
          return (
            <div key={a.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${a.tag ? "border-indigo-100 bg-indigo-50/40" : "border-slate-100"}`}>
              <span className="text-sm text-slate-900">
                {a.label}
                {badges}
              </span>
              {buttons}
              {hidden}
            </div>
          );
        }

        const shown = hover?.id === a.id ? hover.score : scores[a.id];
        const meaning = shown ? standard.levels.find((l) => l.score === shown)?.description : null;
        const expanded = !!open[a.id];
        return (
          <div key={a.id} className={`rounded-xl border bg-white p-4 ${scores[a.id] !== undefined ? "border-indigo-200" : a.optional ? "border-dashed border-slate-300" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {index + 1}. {a.label}
                  {badges}
                </p>
                {standard.definition && <p className="mt-0.5 text-xs text-slate-500">{standard.definition}</p>}
              </div>
              <div className="w-full sm:w-auto">{buttons}</div>
            </div>
            {standard.note && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <b>Catatan khusus aspek ini:</b> {standard.note}
              </p>
            )}
            {shown && meaning ? (
              <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                <p className="text-xs font-semibold text-indigo-800">
                  Nilai {shown} · {SCORE_LABEL[shown]} berarti
                </p>
                <p className="mt-1 text-sm text-slate-800">{meaning}</p>
              </div>
            ) : (
              standard.levels.length > 0 && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Arahkan atau pilih sebuah nilai untuk melihat artinya.</p>
            )}
            {standard.levels.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen((cur) => ({ ...cur, [a.id]: !cur[a.id] }))}
                  className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
                >
                  {expanded ? "Tutup perbandingan ▴" : "Bandingkan semua nilai ▾"}
                </button>
                {expanded && (
                  <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                    {standard.levels.map((l) => {
                      const selected = scores[a.id] === l.score;
                      return (
                        <button key={l.score} type="button" onClick={() => choose(a, l.score)} className={`flex w-full gap-3 p-3 text-left ${selected ? "bg-indigo-50/70" : "hover:bg-slate-50"}`}>
                          <span className={`grid h-8 w-10 shrink-0 place-items-center rounded-md text-sm font-semibold tabular-nums ${selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>{l.score}</span>
                          <span>
                            <span className={`block text-xs font-semibold ${selected ? "text-indigo-800" : "text-slate-700"}`}>
                              {SCORE_LABEL[l.score]}
                              {selected ? " · nilai Anda" : ""}
                            </span>
                            <span className="text-slate-700">{l.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {hidden}
          </div>
        );
      })}
    </div>
  );
}

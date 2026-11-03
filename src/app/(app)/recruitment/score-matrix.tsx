"use client";

import { SCORE_LABEL, SCORE_STEPS } from "@/lib/interview-matrix";

export interface MatrixAspectInfo {
  id: string;
  label: string;
  /** May be left empty; shows "opsional" and can be cleared by pressing the chosen number again. */
  optional?: boolean;
  /** Shown as a small tag, e.g. "khusus HR". */
  tag?: string;
}

// The score matrix used by the HR form and the interviewer form: one row per aspect, 2 / 4 / 6 / 8 / 10 as buttons.
// Sends a hidden field score_<aspectId> for every aspect that has a score.
export function ScoreMatrix({ aspects, scores, onChange }: { aspects: MatrixAspectInfo[]; scores: Record<string, number>; onChange: (next: Record<string, number>) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {SCORE_STEPS.map((n, i) => (
          <span key={n}>
            {i > 0 && " · "}
            <b className="tabular-nums text-slate-800">{n}</b> {SCORE_LABEL[n].toLowerCase()}
          </span>
        ))}
      </div>
      {aspects.map((a) => (
        <div key={a.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${a.tag ? "border-indigo-100 bg-indigo-50/40" : "border-slate-100"}`}>
          <span className="text-sm text-slate-900">
            {a.label}
            {a.optional && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">opsional</span>}
            {a.tag && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{a.tag}</span>}
          </span>
          <div className="flex gap-1.5" role="group" aria-label={a.label}>
            {SCORE_STEPS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={scores[a.id] === n}
                title={SCORE_LABEL[n]}
                onClick={() => {
                  const next = { ...scores };
                  if (scores[a.id] === n && a.optional) delete next[a.id];
                  else next[a.id] = n;
                  onChange(next);
                }}
                className={`h-9 w-10 rounded-lg border text-sm font-semibold tabular-nums ${scores[a.id] === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}
              >
                {n}
              </button>
            ))}
          </div>
          {scores[a.id] !== undefined && <input type="hidden" name={`score_${a.id}`} value={scores[a.id]} />}
        </div>
      ))}
    </div>
  );
}

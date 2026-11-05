"use client";

import { useState } from "react";
import { textLines, type CriterionStandard } from "@/lib/evaluation-standard";

export interface CardCriterion {
  key: string;
  label: string;
  standard?: CriterionStandard | null;
}

const letter = (i: number) => String.fromCharCode(65 + i);

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

// One section of the evaluation (Performance or Tata Nilai) as cards, like the interview score form: the criterion with its
// definition, a button per grade, and the meaning of the grade pointed at or chosen. "Bandingkan semua nilai" lists every
// grade of the version of the standard that applies; a criterion with more than one version shows which one is meant for this
// person and lets the evaluator read the others. Sends the grade of every criterion as a hidden field `fieldOf(key)`.
export function CriterionCards({
  title,
  hint,
  criteria,
  scale,
  gradeName,
  numbering,
  fieldOf,
  values,
  onPick,
  highlightMissing,
  toolbar,
}: {
  title: string;
  hint: string;
  criteria: CardCriterion[];
  scale: readonly number[];
  gradeName?: Record<number, string>;
  numbering: "letter" | "number";
  fieldOf: (key: string) => string;
  values: Record<string, number | undefined>;
  onPick: (key: string, n: number) => void;
  highlightMissing: boolean;
  toolbar?: React.ReactNode;
}) {
  const [hover, setHover] = useState<{ key: string; score: number } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<Record<string, string>>({});
  const nameOf = (n: number) => gradeName?.[n];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        {toolbar}
      </div>
      <div className="mt-3 space-y-3">
        {criteria.map((c, index) => {
          const value = values[c.key];
          const missing = highlightMissing && value === undefined;
          const standard = c.standard ?? null;
          const marker = numbering === "letter" ? letter(index) : String(index + 1);
          const buttons = (
            <div className={`grid gap-1.5 sm:flex ${scale.length > 5 ? "grid-cols-5" : "grid-cols-5"}`} role="group" aria-label={c.label}>
              {scale.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={value === n}
                  title={nameOf(n) ?? String(n)}
                  onClick={() => onPick(c.key, n)}
                  onMouseEnter={() => setHover({ key: c.key, score: n })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ key: c.key, score: n })}
                  onBlur={() => setHover(null)}
                  className={`h-9 min-w-10 rounded-lg border px-1 text-sm font-semibold tabular-nums ${value === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          );
          const hidden = value !== undefined && <input type="hidden" name={fieldOf(c.key)} value={value} />;

          if (!standard || standard.variants.every((v) => v.levels.length === 0)) {
            return (
              <div key={c.key} data-missing={missing ? "true" : undefined} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${missing ? "border-amber-300 bg-amber-50" : "border-slate-100"}`}>
                <span className="text-sm text-slate-900">
                  {marker}. {c.label}
                  {standard?.definition && <span className="block text-xs text-slate-500">{standard.definition}</span>}
                </span>
                {buttons}
                {hidden}
              </div>
            );
          }

          const multi = standard.variants.length > 1;
          const chosen = standard.variants.find((v) => v.key === standard.chosen) ?? standard.variants[0];
          const viewKey = viewing[c.key] ?? chosen.key;
          const viewed = standard.variants.find((v) => v.key === viewKey) ?? chosen;
          const shown = hover?.key === c.key ? hover.score : value;
          const meaning = shown !== undefined ? viewed.levels.find((l) => l.score === shown)?.description : null;
          const expanded = !!open[c.key];
          return (
            <div
              key={c.key}
              data-missing={missing ? "true" : undefined}
              className={`rounded-xl border bg-white p-4 ${missing ? "border-amber-300 shadow-[inset_3px_0_0_#f59e0b]" : value !== undefined ? "border-indigo-200" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {marker}. {c.label}
                    {multi && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{chosen.label}</span>}
                  </p>
                  {standard.definition && <p className="mt-0.5 text-xs text-slate-500">{standard.definition}</p>}
                </div>
                <div className="w-full sm:w-auto">{buttons}</div>
              </div>
              {standard.note && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <b>Catatan khusus:</b> {standard.note}
                </p>
              )}
              {meaning ? (
                <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                  <p className="text-xs font-semibold text-indigo-800">
                    Nilai {shown}
                    {nameOf(shown as number) ? ` · ${nameOf(shown as number)}` : ""} berarti
                  </p>
                  <div className="mt-1 text-sm text-slate-800">
                    <Lines text={meaning} />
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Arahkan atau pilih sebuah nilai untuk melihat artinya.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <button type="button" aria-expanded={expanded} onClick={() => setOpen((cur) => ({ ...cur, [c.key]: !cur[c.key] }))} className="font-medium text-indigo-600 hover:underline">
                  {expanded ? "Tutup perbandingan ▴" : "Bandingkan semua nilai ▾"}
                </button>
              </div>
              {multi && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Standar yang dibaca:</span>
                  {standard.variants.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setViewing((cur) => ({ ...cur, [c.key]: v.key }))}
                      className={`rounded-full border px-3 py-1 ${v.key === viewed.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {v.label}
                      {v.key === chosen.key ? " · berlaku untuk karyawan ini" : ""}
                    </button>
                  ))}
                </div>
              )}
              {expanded && (
                <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {[...viewed.levels].map((l) => {
                    const selected = value === l.score;
                    return (
                      <button key={l.score} type="button" onClick={() => onPick(c.key, l.score)} className={`flex w-full gap-3 p-3 text-left ${selected ? "bg-indigo-50/70" : "hover:bg-slate-50"}`}>
                        <span className={`grid h-8 min-w-10 shrink-0 place-items-center rounded-md px-1 text-sm font-semibold tabular-nums ${selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>{l.score}</span>
                        <span className="min-w-0 text-slate-700">
                          {(nameOf(l.score) || selected) && (
                            <span className={`block text-xs font-semibold ${selected ? "text-indigo-800" : "text-slate-700"}`}>
                              {nameOf(l.score) ?? ""}
                              {selected ? `${nameOf(l.score) ? " · " : ""}nilai Anda` : ""}
                            </span>
                          )}
                          <Lines text={l.description} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {hidden}
            </div>
          );
        })}
      </div>
    </section>
  );
}

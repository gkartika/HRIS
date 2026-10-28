"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_OPTIONS } from "@/lib/recruitment-candidates";
import { questionFormatWarnings } from "@/lib/question-format";
import type { RecruitmentTestForm } from "@/generated/prisma/enums";
import { QuestionPreview } from "./question-preview";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const lab = "mb-1 block text-xs text-slate-500";

const splitOptions = (text: string) => text.split("\n").map((o) => o.trim()).filter(Boolean);

// The fields of one question, with a preview beside them that changes while typing. The fields stay plain
// (uncontrolled) inputs so the surrounding form reads them as before; the preview only listens.
export function QuestionFields({
  form,
  monospace,
  defaults,
  idPrefix,
  label,
}: {
  form: RecruitmentTestForm;
  monospace: boolean;
  defaults?: { prompt: string; options: string[]; correctIndex: number | null; reverseScored: boolean };
  idPrefix: string;
  label: string;
}) {
  const [prompt, setPrompt] = useState(defaults?.prompt ?? "");
  const [optionsText, setOptionsText] = useState(defaults?.options.join("\n") ?? "");
  const root = useRef<HTMLDivElement>(null);

  // "Tambah soal" empties the form after saving; the preview empties with it.
  useEffect(() => {
    const formEl = root.current?.closest("form");
    if (!formEl) return;
    const onReset = () =>
      setTimeout(() => {
        setPrompt((formEl.elements.namedItem("prompt") as HTMLTextAreaElement | null)?.value ?? "");
        setOptionsText((formEl.elements.namedItem("options") as HTMLTextAreaElement | null)?.value ?? "");
      }, 0);
    formEl.addEventListener("reset", onReset);
    return () => formEl.removeEventListener("reset", onReset);
  }, []);

  const warnings = questionFormatWarnings(prompt);

  return (
    <div ref={root} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className={lab} htmlFor={`${idPrefix}-prompt`}>{form === "SCALE" ? "Pernyataan" : "Soal"}</label>
          <textarea
            id={`${idPrefix}-prompt`}
            name="prompt"
            rows={form === "ESSAY" ? 12 : 3}
            required
            defaultValue={defaults?.prompt}
            onInput={(e) => setPrompt(e.currentTarget.value)}
            className={field}
          />
        </div>
        {form === "MULTIPLE_CHOICE" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={lab} htmlFor={`${idPrefix}-options`}>Opsi jawaban (satu per baris, 2 sampai {MAX_OPTIONS})</label>
              <textarea id={`${idPrefix}-options`} name="options" rows={4} required defaultValue={defaults?.options.join("\n")} onInput={(e) => setOptionsText(e.currentTarget.value)} className={field} />
            </div>
            <div>
              <label className={lab} htmlFor={`${idPrefix}-correct`}>Nomor jawaban yang benar</label>
              <input id={`${idPrefix}-correct`} name="correct" type="number" min={1} max={MAX_OPTIONS} required defaultValue={defaults?.correctIndex != null ? defaults.correctIndex + 1 : undefined} className={field} />
              <p className="mt-1 text-[11px] text-slate-400">1 = opsi pertama.</p>
            </div>
          </div>
        )}
        {form === "SCALE" && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="reverse" defaultChecked={defaults?.reverseScored} />
            Pernyataan terbalik (jawaban &quot;Sangat setuju&quot; justru nilainya paling rendah)
          </label>
        )}
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-xs text-slate-500">Pratinjau <span className="text-[11px] text-slate-400">· berubah saat Anda mengetik</span></p>
        <QuestionPreview form={form} monospace={monospace} prompt={prompt} options={splitOptions(optionsText)} label={label} />
        {warnings.length > 0 && (
          <div className="mt-2 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            {warnings.map((w) => (
              <p key={w}>
                <b>Perhatikan:</b> {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

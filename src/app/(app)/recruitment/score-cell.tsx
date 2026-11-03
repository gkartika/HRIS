"use client";

import { useState } from "react";
import { SCORE_LABEL } from "@/lib/interview-matrix";

// A score in the results table with its name; pressing it shows what that score means for the aspect (the standard).
export function ScoreCell({ score, maxScore, description }: { score: number; maxScore: number; description: string | null }) {
  const [open, setOpen] = useState(false);
  if (maxScore !== 10) return <span>{score} <span className="text-xs text-slate-400">dari {maxScore}</span></span>;
  const name = SCORE_LABEL[score] ?? "";
  if (!description) {
    return (
      <span>
        {score} <span className="text-xs text-slate-400">{name}</span>
      </span>
    );
  }
  return (
    <span>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-left hover:text-indigo-700">
        {score} <span className="text-xs text-slate-400 underline decoration-dotted">{name}</span>
      </button>
      {open && <span className="mt-1 block max-w-xs rounded-md bg-indigo-50 px-2 py-1.5 text-xs font-normal text-slate-700">{description}</span>}
    </span>
  );
}

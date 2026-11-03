// The interview standard ("Matriks Penilaian Hasil Wawancara"): what an aspect means and what 2, 4, 6, 8 and 10 each mean
// for it, shown to the person scoring. Pure rules, no Prisma, so they are unit tested.
import { SCORE_LABEL, SCORE_STEPS } from "@/lib/interview-matrix";

export interface StandardLevel {
  score: number;
  description: string;
}

export interface AspectStandard {
  definition: string | null;
  /** A note for this aspect only, e.g. "skor berdasarkan 5 nilai budaya CBP". */
  note: string | null;
  levels: StandardLevel[];
}

export interface StandardSource {
  id: string;
  definition: string | null;
  note: string | null;
  levels: StandardLevel[];
  /** The HR copy of a user aspect points at it and uses its standard. */
  standardOf?: { id: string; definition: string | null; note: string | null; levels: StandardLevel[] } | null;
}

const clean = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

// The standard an aspect shows: its own, or the one of the aspect it shares with. Levels come out from 10 down to 2 and only
// the five valid scores with some text are kept. Null when there is nothing to show (Energy and Energize have no standard).
export function resolveStandard(aspect: StandardSource): AspectStandard | null {
  const source = aspect.standardOf ?? aspect;
  const levels = source.levels
    .filter((l) => (SCORE_STEPS as readonly number[]).includes(l.score) && clean(l.description))
    .map((l) => ({ score: l.score, description: l.description.trim() }))
    .sort((a, b) => b.score - a.score);
  const standard: AspectStandard = { definition: clean(source.definition), note: clean(aspect.note) ?? clean(source.note), levels };
  return standard.definition || standard.note || levels.length > 0 ? standard : null;
}

export function levelDescription(standard: AspectStandard | null | undefined, score: number): string | null {
  return standard?.levels.find((l) => l.score === score)?.description ?? null;
}

export function levelTitle(score: number): string {
  return `${score} · ${SCORE_LABEL[score] ?? ""}`.trim();
}

// The text boxes of the settings form, five levels in order 2..10; an empty box means no text for that score.
export function levelsFromForm(get: (score: number) => string): { score: number; description: string }[] {
  return SCORE_STEPS.map((score) => ({ score, description: get(score).trim() })).filter((l) => l.description.length > 0);
}

export const STANDARD_TEXT_MAX = 1200;

export function standardProblem(input: { definition: string; note: string; levels: { score: number; description: string }[] }): string | null {
  if (input.definition.length > STANDARD_TEXT_MAX || input.note.length > STANDARD_TEXT_MAX) return `Definisi dan catatan maksimal ${STANDARD_TEXT_MAX} karakter.`;
  for (const l of input.levels) {
    if (l.description.length > STANDARD_TEXT_MAX) return `Teks nilai ${l.score} terlalu panjang (maksimal ${STANDARD_TEXT_MAX} karakter).`;
  }
  return null;
}

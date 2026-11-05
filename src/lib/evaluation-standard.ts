// The standard of the Evaluasi Kinerja matrix: what each criterion means and what each grade means, shown to the evaluator.
// A criterion can have more than one version of its texts (Kepemimpinan: individual or with subordinates; Pengambilan
// Keputusan: by job level); the version for the person being evaluated is chosen when the evaluation is released and stays
// with it. Pure rules, no Prisma, so they are unit tested.

export interface StandardLevel {
  score: number;
  description: string;
}

export interface StandardVariant {
  key: string;
  label: string;
  levels: StandardLevel[];
}

// The copy stored on an evaluation: the texts as they were when it was released, and the version chosen for this person.
export interface CriterionStandard {
  definition: string | null;
  note: string | null;
  variants: StandardVariant[];
  chosen: string;
}

export interface VariantRule {
  key: string;
  sortOrder: number;
  /** Comma separated job levels; HL stands for Harian Lepas (employment status). */
  appliesToLevels: string | null;
  /** true: has people reporting to them; false: has none; null: not decided by this. */
  appliesToSubordinates: boolean | null;
}

export interface VariantContext {
  jobLevel: string | null;
  employmentStatus: string | null;
  hasSubordinates: boolean;
}

export const DEFAULT_VARIANT = "DEFAULT";

const tokens = (list: string | null) => (list ?? "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);

// The first version (in order) that is meant for this person, or null when none is.
export function pickVariantKey(rules: VariantRule[], ctx: VariantContext): string | null {
  const level = ctx.jobLevel?.trim().toUpperCase() ?? "";
  for (const r of [...rules].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (r.appliesToSubordinates !== null) {
      if (r.appliesToSubordinates === ctx.hasSubordinates) return r.key;
      continue;
    }
    const list = tokens(r.appliesToLevels);
    if (list.length === 0) continue;
    if ((level && list.includes(level)) || (ctx.employmentStatus === "HARIAN_LEPAS" && list.includes("HL"))) return r.key;
  }
  return null;
}

export interface CriterionStandardSource {
  definition: string | null;
  note: string | null;
  variants: { key: string; label: string; sortOrder: number; appliesToLevels: string | null; appliesToSubordinates: boolean | null }[];
  levels: { variantKey: string; score: number; description: string }[];
}

const clean = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

// What goes on an evaluation at release. `override` is a version Admin SDM picked by hand. Null when the criterion has no standard.
export function buildCriterionStandard(source: CriterionStandardSource, ctx: VariantContext, override?: string | null): CriterionStandard | null {
  const levelsOf = (key: string) =>
    source.levels
      .filter((l) => l.variantKey === key && clean(l.description))
      .map((l) => ({ score: l.score, description: l.description.trim() }))
      .sort((a, b) => b.score - a.score);
  const declared = [...source.variants].sort((a, b) => a.sortOrder - b.sortOrder);
  const variants: StandardVariant[] = declared.length > 0 ? declared.map((v) => ({ key: v.key, label: v.label, levels: levelsOf(v.key) })) : [{ key: DEFAULT_VARIANT, label: "", levels: levelsOf(DEFAULT_VARIANT) }];
  const withTexts = variants.filter((v) => v.levels.length > 0);
  if (withTexts.length === 0 && !clean(source.definition) && !clean(source.note)) return null;
  const keys = variants.map((v) => v.key);
  const picked = override && keys.includes(override) ? override : (pickVariantKey(declared, ctx) ?? keys[0]);
  return { definition: clean(source.definition), note: clean(source.note), variants, chosen: picked };
}

export function chosenVariant(standard: CriterionStandard | null | undefined): StandardVariant | null {
  return standard?.variants.find((v) => v.key === standard.chosen) ?? standard?.variants[0] ?? null;
}

export function levelText(standard: CriterionStandard | null | undefined, score: number, variantKey?: string): string | null {
  const variant = variantKey ? standard?.variants.find((v) => v.key === variantKey) : chosenVariant(standard);
  return variant?.levels.find((l) => l.score === score)?.description ?? null;
}

// A text with one behaviour per line (Tata Nilai) is shown as a list; one line is plain text.
export function textLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function isCriterionStandard(value: unknown): value is CriterionStandard {
  if (typeof value !== "object" || value === null) return false;
  const s = value as CriterionStandard;
  return (
    typeof s.chosen === "string" &&
    Array.isArray(s.variants) &&
    s.variants.every((v) => typeof v?.key === "string" && typeof v.label === "string" && Array.isArray(v.levels) && v.levels.every((l) => typeof l?.score === "number" && typeof l.description === "string"))
  );
}

// The settings form: one text per grade of one version; an empty box means no text for that grade.
export function levelsFromTexts(scale: readonly number[], get: (score: number) => string): StandardLevel[] {
  return scale.map((score) => ({ score, description: get(score).replace(/\r\n/g, "\n").trim() })).filter((l) => l.description.length > 0);
}

export const STANDARD_TEXT_MAX = 2000;

export function standardProblem(input: { definition: string; note: string; levels: StandardLevel[] }): string | null {
  if (input.definition.length > STANDARD_TEXT_MAX || input.note.length > STANDARD_TEXT_MAX) return `Definisi dan catatan maksimal ${STANDARD_TEXT_MAX} karakter.`;
  for (const l of input.levels) if (l.description.length > STANDARD_TEXT_MAX) return `Teks nilai ${l.score} terlalu panjang (maksimal ${STANDARD_TEXT_MAX} karakter).`;
  return null;
}

// "Berlaku untuk" typed by Admin SDM: levels like "1A, 2B, HL" (case and spaces do not matter), checked against the known levels.
export function parseLevelList(raw: string, known: string[]): { ok: true; value: string | null } | { ok: false; error: string } {
  const list = tokens(raw);
  if (list.length === 0) return { ok: true, value: null };
  const valid = new Set([...known.map((k) => k.toUpperCase()), "HL", "DIRECTOR"]);
  const unknown = list.filter((t) => !valid.has(t));
  if (unknown.length > 0) return { ok: false, error: `Level tidak dikenal: ${unknown.join(", ")}.` };
  return { ok: true, value: [...new Set(list)].join(",") };
}

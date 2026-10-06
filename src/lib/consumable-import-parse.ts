// Pure parsing helpers for the consumables import datasets. The old
// inventory system's exports use headers like "Kode Barang" / "Nama Karyawan"
// and dd/mm/yyyy dates, so every field accepts a few header spellings and the
// parsers are forgiving about format but strict about meaning.

export function normalizeHeader(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// First non-empty value among the given header aliases (case, spaces and
// punctuation ignored). Returns "" when none is present.
export function pick(raw: Record<string, string>, ...aliases: string[]): string {
  const wanted = aliases.map(normalizeHeader);
  for (const [key, value] of Object.entries(raw)) {
    if (!wanted.includes(normalizeHeader(key))) continue;
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function hasHeader(raw: Record<string, string>, ...aliases: string[]): boolean {
  const wanted = aliases.map(normalizeHeader);
  return Object.keys(raw).some((k) => wanted.includes(normalizeHeader(k)));
}

// A day written dd/mm/yyyy (also dd-mm-yyyy, dd.mm.yy) or yyyy-mm-dd, with an
// optional HH:mm[:ss]. A date without a time lands at noon WIB so the company
// day is never ambiguous; with a time it is that WIB wall-clock instant.
// Returns null for anything that is not a real calendar date.
export function parseFlexibleDate(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);

  let year: number;
  let month: number;
  let day: number;
  let rest: (string | undefined)[];
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    rest = [iso[4], iso[5], iso[6]];
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    rest = [dmy[4], dmy[5], dmy[6]];
  } else {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  const hasTime = rest[0] !== undefined;
  const hour = hasTime ? Number(rest[0]) : 12;
  const minute = hasTime ? Number(rest[1]) : 0;
  const second = hasTime ? Number(rest[2] ?? 0) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
}

// Whole numbers only: "12", "+20", "-5", "1.000" is NOT treated as a thousands
// separator (returns null) so a stray decimal can't silently become a count.
export function parseIntStrict(value: string): number | null {
  const text = value.trim();
  if (!/^[+-]?\d+$/.test(text)) return null;
  return Number(text);
}

export function parseCategory(value: string): "APD" | "ATK" | null {
  const v = value.trim().toUpperCase();
  return v === "APD" || v === "ATK" ? v : null;
}

export function isCancelledStatus(value: string): boolean {
  return /batal|cancel/i.test(value);
}

export function isArchivedStatus(value: string): boolean {
  return /arsip|archiv|nonaktif|non-aktif|inactive/i.test(value);
}

// Day key (company-local, WIB) used to spot a row that was imported before.
export function dayKey(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

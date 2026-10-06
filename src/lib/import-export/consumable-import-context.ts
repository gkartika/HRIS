import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/name-match";
import { dayKey } from "@/lib/consumable-import-parse";
import type { ConsumableTxType } from "@/generated/prisma/enums";

export interface ImportItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
}

export interface ImportContext {
  itemsByCode: Map<string, ImportItem>;
  itemsByName: Map<string, ImportItem[]>;
  // normalized name -> employee id, or null when two employees share the name
  // (an ambiguous name is never guessed; it is kept as text instead).
  employeeIdByName: Map<string, string | null>;
  employeeNameById: Map<string, string>;
}

export async function loadImportContext(): Promise<ImportContext> {
  const [items, employees] = await Promise.all([
    prisma.consumableItem.findMany({ select: { id: true, itemCode: true, itemName: true, category: true } }),
    prisma.employee.findMany({ select: { id: true, fullLegalName: true } }),
  ]);
  const itemsByCode = new Map(items.map((i) => [i.itemCode.toUpperCase(), i]));
  const itemsByName = new Map<string, ImportItem[]>();
  for (const i of items) {
    const key = normalizeName(i.itemName);
    itemsByName.set(key, [...(itemsByName.get(key) ?? []), i]);
  }
  const employeeIdByName = new Map<string, string | null>();
  for (const e of employees) {
    const key = normalizeName(e.fullLegalName);
    employeeIdByName.set(key, employeeIdByName.has(key) ? null : e.id);
  }
  return { itemsByCode, itemsByName, employeeIdByName, employeeNameById: new Map(employees.map((e) => [e.id, e.fullLegalName])) };
}

// commitRow runs once per row inside one request; re-reading every item and
// employee for each row would make a few-thousand-row logbook crawl, so the
// lookups are reused for a short window. dryRun always loads fresh.
let cached: { at: number; ctx: ImportContext } | null = null;
const TTL_MS = 30_000;

export async function getCachedImportContext(): Promise<ImportContext> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.ctx;
  const ctx = await loadImportContext();
  cached = { at: Date.now(), ctx };
  return ctx;
}

// Item named by a code column and/or a name column. A code wins; a name that
// matches several items is only usable if the category narrows it to one.
export function resolveImportItem(
  ctx: ImportContext,
  code: string,
  name: string,
  category: string | null
): { item: ImportItem } | { error: string } {
  if (code) {
    const byCode = ctx.itemsByCode.get(code.toUpperCase());
    if (byCode) return { item: byCode };
    // Some exports put the code in the "Barang" column.
    if (!name) return { error: `Kode barang "${code}" tidak ditemukan. Impor Master Barang Habis Pakai terlebih dahulu.` };
  }
  if (name) {
    const asCode = ctx.itemsByCode.get(name.toUpperCase());
    if (asCode) return { item: asCode };
    const matches = ctx.itemsByName.get(normalizeName(name)) ?? [];
    const narrowed = category ? matches.filter((m) => m.category === category) : matches;
    if (narrowed.length === 1) return { item: narrowed[0] };
    if (narrowed.length > 1) return { error: `Nama barang "${name}" cocok dengan lebih dari satu barang. Isi kolom Kode Barang.` };
    return { error: `Barang "${name}" tidak ditemukan. Impor Master Barang Habis Pakai terlebih dahulu.` };
  }
  return { error: "Kode atau nama barang wajib diisi." };
}

// How many ledger rows with this identity were already imported, so a
// re-uploaded file skips them instead of doubling the history. The Nth
// identical row of a file is skipped only if at least N already exist.
export async function loadImportedKeyCounts(type: ConsumableTxType): Promise<Map<string, number>> {
  const rows = await prisma.consumableTransaction.findMany({
    where: { source: "IMPORT", type },
    select: { itemId: true, occurredAt: true, quantityDelta: true, recipientNameSnapshot: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = importKey(type, r.itemId, r.occurredAt, r.quantityDelta, r.recipientNameSnapshot);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function importKey(type: ConsumableTxType, itemId: string, at: Date, delta: number, recipientName: string | null): string {
  return [type, itemId, dayKey(at), delta, type === "ISSUE" ? normalizeName(recipientName ?? "") : ""].join("|");
}

// Returns true when this row repeats one that was already imported (existing
// count not yet used up by earlier identical rows of the same file).
export function isAlreadyImported(existing: Map<string, number>, seenInFile: Map<string, number>, key: string): boolean {
  const nth = (seenInFile.get(key) ?? 0) + 1;
  seenInFile.set(key, nth);
  return (existing.get(key) ?? 0) >= nth;
}

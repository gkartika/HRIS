// Reading one row of the Master Aset Tetap import. Nothing here rejects a row:
// every field is optional, and a value that cannot be used is dropped (or
// replaced by a default) with a note, so a messy sheet still imports. Pure
// logic, no Prisma imports, so it is unit testable.
import { normalizeAssetCategory } from "@/lib/asset-categories";

export const ASSET_IMPORT_FIELDS = [
  "assetCode",
  "assetName",
  "category",
  "assetNumber",
  "modelBrand",
  "specification",
  "trackingType",
  "totalQuantity",
  "purchaseDate",
  "purchaseCost",
  "notes",
] as const;
export type AssetImportField = (typeof ASSET_IMPORT_FIELDS)[number];
export type AssetImportRow = Record<AssetImportField, string>;

// Column names people actually use, matched ignoring case, spaces and punctuation.
const HEADER_ALIASES: Record<string, AssetImportField> = {
  assetcode: "assetCode",
  kodeaset: "assetCode",
  kode: "assetCode",
  assetname: "assetName",
  namaaset: "assetName",
  namabarang: "assetName",
  nama: "assetName",
  category: "category",
  kategori: "category",
  assetnumber: "assetNumber",
  noaset: "assetNumber",
  nomoraset: "assetNumber",
  modelbrand: "modelBrand",
  modeltipemerek: "modelBrand",
  model: "modelBrand",
  merek: "modelBrand",
  tipe: "modelBrand",
  specification: "specification",
  spesifikasi: "specification",
  spek: "specification",
  trackingtype: "trackingType",
  tipepelacakan: "trackingType",
  pelacakan: "trackingType",
  totalquantity: "totalQuantity",
  jumlahtotal: "totalQuantity",
  jumlah: "totalQuantity",
  kuantitas: "totalQuantity",
  qty: "totalQuantity",
  purchasedate: "purchaseDate",
  tanggalpembelian: "purchaseDate",
  tanggalbeli: "purchaseDate",
  purchasecost: "purchaseCost",
  hargabeli: "purchaseCost",
  harga: "purchaseCost",
  notes: "notes",
  catatan: "notes",
  keterangan: "notes",
};

// One sheet row -> the eleven known fields as trimmed text. Unknown columns are
// ignored; a column that is missing is just blank.
export function toAssetImportRow(raw: Record<string, string>): AssetImportRow {
  const row = Object.fromEntries(ASSET_IMPORT_FIELDS.map((f) => [f, ""])) as AssetImportRow;
  for (const [header, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[header.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (field && !row[field]) row[field] = String(value ?? "").trim();
  }
  return row;
}

export function isBlankAssetRow(row: AssetImportRow): boolean {
  return ASSET_IMPORT_FIELDS.every((f) => !row[f]);
}

// "12/03/2026", "12-3-2026", "12.03.2026" (day first) or "2026-03-12"; a real calendar date or null.
export function parseImportDate(text: string): Date | null {
  const t = text.trim();
  if (!t) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

// "12000000", "12.000.000", "Rp 12.000.000,50", "12,000,000.50" -> number; junk or negative -> null.
export function parseImportMoney(text: string): number | null {
  const t = text.replace(/rp\.?/i, "").replace(/\s/g, "");
  if (!t) return null;
  let normalized = t;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) normalized = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) normalized = t.replace(/,/g, "");
  else normalized = t.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function parseTrackingType(text: string): "INDIVIDUAL" | "QUANTITY_TRACKED" | null {
  const key = text.toLowerCase().replace(/[^a-z]/g, "");
  if (["individual", "individu", "satuan"].includes(key)) return "INDIVIDUAL";
  if (["kuantitas", "quantity", "quantitytracked", "jumlah"].includes(key)) return "QUANTITY_TRACKED";
  return null;
}

export interface InterpretedAsset {
  assetCode: string | null; // null: a code is made when the asset is created
  assetName: string | null; // exactly what the sheet had
  displayName: string; // the sheet's name, else model, else No Aset, else a placeholder
  category: string | null;
  assetNumber: string | null;
  modelBrand: string | null;
  specification: string | null;
  trackingType: "INDIVIDUAL" | "QUANTITY_TRACKED" | null; // null: not given or not understood
  totalQuantity: number | null;
  purchaseDate: Date | null;
  purchaseCost: number | null;
  notes: string | null;
  /** What was dropped, defaulted or made up, in Indonesian, for the preview. */
  warnings: string[];
}

export function interpretAssetRow(row: AssetImportRow): InterpretedAsset {
  const warnings: string[] = [];
  const blank = (s: string) => s.trim() || null;

  let category: string | null = null;
  let notes = blank(row.notes);
  if (row.category) {
    category = normalizeAssetCategory(row.category);
    if (!category) {
      warnings.push(`Kategori "${row.category}" bukan Umum/IT/Kendaraan, dikosongkan dan ditulis di Catatan`);
      const original = `Kategori dari berkas: ${row.category}`;
      notes = notes ? `${notes} | ${original}` : original;
    }
  }

  const trackingType = row.trackingType ? parseTrackingType(row.trackingType) : null;
  if (row.trackingType && !trackingType) warnings.push(`Tipe pelacakan "${row.trackingType}" tidak dikenali, dipakai Individual`);

  let totalQuantity: number | null = null;
  if (trackingType === "QUANTITY_TRACKED") {
    const n = Number(row.totalQuantity.replace(",", "."));
    if (row.totalQuantity && Number.isInteger(n) && n > 0) totalQuantity = n;
    else {
      totalQuantity = 1;
      warnings.push(
        row.totalQuantity ? `Jumlah total "${row.totalQuantity}" tidak valid, dipakai 1` : "Jumlah total kosong untuk aset Kuantitas, dipakai 1"
      );
    }
  }

  let purchaseDate: Date | null = null;
  if (row.purchaseDate) {
    purchaseDate = parseImportDate(row.purchaseDate);
    if (!purchaseDate) warnings.push(`Tanggal pembelian "${row.purchaseDate}" tidak terbaca, dikosongkan`);
  }
  let purchaseCost: number | null = null;
  if (row.purchaseCost) {
    purchaseCost = parseImportMoney(row.purchaseCost);
    if (purchaseCost === null) warnings.push(`Harga beli "${row.purchaseCost}" tidak terbaca, dikosongkan`);
  }

  const assetName = blank(row.assetName);
  const displayName = assetName ?? blank(row.modelBrand) ?? blank(row.assetNumber) ?? "(Tanpa nama)";
  if (!assetName) warnings.push(`Nama aset kosong, dipakai "${displayName}"`);

  return {
    assetCode: blank(row.assetCode),
    assetName,
    displayName,
    category,
    assetNumber: blank(row.assetNumber),
    modelBrand: blank(row.modelBrand),
    specification: blank(row.specification),
    trackingType,
    totalQuantity,
    purchaseDate,
    purchaseCost,
    notes,
    warnings,
  };
}

// Next free "AST-0001"-style code, given every code already in use.
export function nextAssetCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const m = /^AST-(\d+)$/i.exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `AST-${String(max + 1).padStart(4, "0")}`;
}

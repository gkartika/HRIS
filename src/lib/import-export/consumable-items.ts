import { prisma } from "@/lib/db";
import {
  isArchivedStatus,
  parseCategory,
  parseIntStrict,
  pick,
} from "@/lib/consumable-import-parse";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";

export const label = "Master Barang Habis Pakai";
// Same headers the old inventory system's master sheet uses.
export const templateHeaders = ["Kategori", "Kode Barang", "Nama Barang", "Satuan", "Stok Awal", "Stok Min", "Periode Bulan", "Status"];
export const templateExampleRow = {
  Kategori: "APD",
  "Kode Barang": "APD-CONTOH-001",
  "Nama Barang": "Masker KN95",
  Satuan: "pcs",
  "Stok Awal": "100",
  "Stok Min": "20",
  "Periode Bulan": "0",
  Status: "Aktif",
};

interface ParsedItem {
  category: "APD" | "ATK";
  itemCode: string;
  itemName: string;
  unit: string;
  openingStock: number;
  minStock: number;
  replacementPeriodMonths: number;
  archived: boolean;
}

function parseItemRow(raw: Record<string, string>): { item: ParsedItem } | { errors: string[] } {
  const errors: string[] = [];
  const category = parseCategory(pick(raw, "Kategori", "category"));
  const itemCode = pick(raw, "Kode Barang", "Kode", "itemCode").toUpperCase();
  const itemName = pick(raw, "Nama Barang", "Nama", "itemName");
  const unit = pick(raw, "Satuan", "unit");
  const openingStock = parseIntStrict(pick(raw, "Stok Awal", "openingStock") || "0");
  const minStock = parseIntStrict(pick(raw, "Stok Min", "Stok Minimum", "minStock") || "0");
  const period = parseIntStrict(pick(raw, "Periode Bulan", "Periode", "replacementPeriodMonths") || "0");

  if (!category) errors.push("Kategori harus APD atau ATK");
  if (!itemCode) errors.push("Kode Barang wajib diisi");
  if (!itemName) errors.push("Nama Barang wajib diisi");
  if (!unit) errors.push("Satuan wajib diisi");
  if (openingStock === null || openingStock < 0) errors.push("Stok Awal harus bilangan bulat 0 atau lebih");
  if (minStock === null || minStock < 0) errors.push("Stok Min harus bilangan bulat 0 atau lebih");
  if (period === null || period < 0) errors.push("Periode Bulan harus bilangan bulat 0 atau lebih");
  if (errors.length > 0) return { errors };

  return {
    item: {
      category: category!,
      itemCode,
      itemName,
      unit,
      openingStock: openingStock!,
      minStock: minStock!,
      replacementPeriodMonths: period!,
      archived: isArchivedStatus(pick(raw, "Status")),
    },
  };
}

// Updates never touch an existing item's opening stock: once it has ledger
// history, changing it would silently rewrite every balance (use Opname).
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const existing = await prisma.consumableItem.findMany({ select: { id: true, itemCode: true } });
  const existingByCode = new Map(existing.map((i) => [i.itemCode, i.id]));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const parsed = parseItemRow(raw);
    if ("errors" in parsed) {
      return { rowNumber, raw, isValid: false, rejectionReason: parsed.errors.join("; "), action: null };
    }
    const { item } = parsed;
    if (seenInFile.has(item.itemCode)) {
      return { rowNumber, raw, isValid: false, rejectionReason: `Kode Barang ${item.itemCode} duplikat dalam berkas`, action: null };
    }
    seenInFile.add(item.itemCode);
    const existingId = existingByCode.get(item.itemCode);
    return {
      rowNumber,
      raw,
      isValid: true,
      rejectionReason: existingId ? "Barang sudah ada: nama, satuan, stok min, periode dan status diperbarui; stok awal tidak diubah." : null,
      action: existingId ? ("UPDATE" as const) : ("CREATE" as const),
      existingId,
    };
  });
}

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const parsed = parseItemRow(raw);
  if ("errors" in parsed) throw new Error(parsed.errors.join("; "));
  const { item } = parsed;

  const existing = await prisma.consumableItem.findUnique({ where: { itemCode: item.itemCode } });
  if (existing) {
    await prisma.consumableItem.update({
      where: { id: existing.id },
      data: {
        itemName: item.itemName,
        unit: item.unit,
        minStock: item.minStock,
        replacementPeriodMonths: item.replacementPeriodMonths,
        archived: item.archived,
      },
    });
    return { id: existing.id, action: "UPDATE" };
  }

  const created = await prisma.consumableItem.create({
    data: {
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      openingStock: item.openingStock,
      minStock: item.minStock,
      replacementPeriodMonths: item.replacementPeriodMonths,
      archived: item.archived,
      createdByAccountId: session!.user.id,
    },
  });
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const items = await prisma.consumableItem.findMany({ orderBy: [{ category: "asc" }, { itemCode: "asc" }] });
  return {
    headers: templateHeaders,
    rows: items.map((i) => ({
      Kategori: i.category,
      "Kode Barang": i.itemCode,
      "Nama Barang": i.itemName,
      Satuan: i.unit,
      "Stok Awal": String(i.openingStock),
      "Stok Min": String(i.minStock),
      "Periode Bulan": String(i.replacementPeriodMonths),
      Status: i.archived ? "Diarsipkan" : "Aktif",
    })),
  };
}

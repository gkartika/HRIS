import { prisma } from "@/lib/db";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";
import { interpretAssetRow, isBlankAssetRow, nextAssetCode, toAssetImportRow } from "@/lib/asset-import";

export const label = "Master Aset Tetap";
export const templateHeaders = [
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
];
export const templateExampleRow = {
  assetCode: "AST-CONTOH-001",
  assetName: "Laptop Dell Latitude",
  category: "IT",
  assetNumber: "AST/IT/2026/001",
  modelBrand: "Dell Latitude 5440",
  specification: "Core i5, RAM 16 GB, SSD 512 GB",
  trackingType: "INDIVIDUAL",
  totalQuantity: "",
  purchaseDate: "2026-01-15",
  purchaseCost: "12000000",
  notes: "",
};

// Bulk import for the asset master. Every column is optional and no row is
// turned away for what it holds: a value that cannot be used is dropped or
// defaulted and the preview says so (see lib/asset-import.ts). Only a row with
// nothing in it is skipped.
//   - No code: one is made when the asset is created (AST-0001, AST-0002, ...).
//   - A code that already exists: that asset is updated, and only with the
//     cells that are filled, so a blank cell never erases what is saved.
//   - trackingType and totalQuantity are set once at CREATE and never changed
//     by a later import row, since a live asset can already have custody
//     history whose quantity math an import row has no safe way to reconcile.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const existing = await prisma.fixedAsset.findMany({ select: { id: true, assetCode: true } });
  const existingByCode = new Map(existing.map((a) => [a.assetCode, a.id]));
  const seenInFile = new Set<string>();

  return rows.map((original, index) => {
    const rowNumber = index + 2;
    const row = toAssetImportRow(original);

    if (isBlankAssetRow(row)) {
      return { rowNumber, raw: row, isValid: false, rejectionReason: "Baris kosong, dilewati", action: null };
    }

    const notes = interpretAssetRow(row).warnings;
    if (row.assetCode && seenInFile.has(row.assetCode)) {
      notes.push(`Kode ${row.assetCode} sudah dipakai baris lain di berkas, kode baru dibuat otomatis`);
      row.assetCode = "";
    }
    if (row.assetCode) seenInFile.add(row.assetCode);

    const existingId = row.assetCode ? existingByCode.get(row.assetCode) : undefined;
    if (existingId) notes.push("Kode sudah ada: aset diperbarui, kolom yang kosong tidak mengubah apa pun");
    else if (!row.assetCode) notes.push("Kode aset dibuat otomatis");

    return {
      rowNumber,
      raw: row,
      isValid: true,
      rejectionReason: notes.length > 0 ? notes.join("; ") : null,
      action: existingId ? "UPDATE" : "CREATE",
      existingId,
    };
  });
}

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const a = interpretAssetRow(toAssetImportRow(raw));

  const existing = a.assetCode ? await prisma.fixedAsset.findUnique({ where: { assetCode: a.assetCode } }) : null;
  if (existing) {
    // Only what the sheet filled in; trackingType and quantity stay as they are.
    const data = {
      ...(a.assetName ? { assetName: a.assetName } : {}),
      ...(a.category ? { category: a.category } : {}),
      ...(a.assetNumber ? { assetNumber: a.assetNumber } : {}),
      ...(a.modelBrand ? { modelBrand: a.modelBrand } : {}),
      ...(a.specification ? { specification: a.specification } : {}),
      ...(a.purchaseDate ? { purchaseDate: a.purchaseDate } : {}),
      ...(a.purchaseCost !== null ? { purchaseCost: a.purchaseCost } : {}),
      ...(a.notes ? { notes: a.notes } : {}),
    };
    await prisma.fixedAsset.update({ where: { id: existing.id }, data });
    return { id: existing.id, action: "UPDATE" };
  }

  let assetCode = a.assetCode;
  if (!assetCode) {
    const codes = await prisma.fixedAsset.findMany({ where: { assetCode: { startsWith: "AST-" } }, select: { assetCode: true } });
    assetCode = nextAssetCode(codes.map((c) => c.assetCode));
  }
  const trackingType = a.trackingType ?? "INDIVIDUAL";
  const totalQuantity = trackingType === "QUANTITY_TRACKED" ? (a.totalQuantity ?? 1) : null;

  const created = await prisma.fixedAsset.create({
    data: {
      assetCode,
      assetName: a.displayName,
      category: a.category,
      assetNumber: a.assetNumber,
      modelBrand: a.modelBrand,
      specification: a.specification,
      trackingType,
      totalQuantity,
      availableQuantity: totalQuantity,
      purchaseDate: a.purchaseDate,
      purchaseCost: a.purchaseCost,
      notes: a.notes,
      createdByAccountId: session!.user.id,
    },
  });
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const assets = await prisma.fixedAsset.findMany({ orderBy: { assetCode: "asc" } });
  return {
    headers: templateHeaders,
    rows: assets.map((a) => ({
      assetCode: a.assetCode,
      assetName: a.assetName,
      category: a.category ?? "",
      assetNumber: a.assetNumber ?? "",
      modelBrand: a.modelBrand ?? "",
      specification: a.specification ?? "",
      trackingType: a.trackingType,
      totalQuantity: a.totalQuantity !== null ? String(a.totalQuantity) : "",
      purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
      purchaseCost: a.purchaseCost !== null ? String(a.purchaseCost) : "",
      notes: a.notes ?? "",
    })),
  };
}

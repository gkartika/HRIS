import { prisma } from "@/lib/db";
import type { AssetTrackingType } from "@/generated/prisma/enums";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";

export const label = "Master Aset Tetap";
export const templateHeaders = [
  "assetCode",
  "assetName",
  "category",
  "trackingType",
  "totalQuantity",
  "purchaseDate",
  "purchaseCost",
  "notes",
];
export const templateExampleRow = {
  assetCode: "AST-CONTOH-001",
  assetName: "Laptop Dell Latitude",
  category: "IT Equipment",
  trackingType: "INDIVIDUAL",
  totalQuantity: "",
  purchaseDate: "2026-01-15",
  purchaseCost: "12000000",
  notes: "",
};

const VALID_TRACKING_TYPES = ["INDIVIDUAL", "QUANTITY_TRACKED"];

// Asset Master import populates/updates catalog entries only (assetName,
// category, purchaseDate, purchaseCost, notes) — per the workflow spec's
// "Asset Master may be imported; operational transactions are completed
// in-app," trackingType and totalQuantity are set once at CREATE and never
// changed by a later import row, since a live asset can already have
// custody history whose quantity math (availableQuantity, open custodies)
// an import row has no safe way to reconcile. Adjusting an existing asset's
// tracking type or stock level is a deliberately out-of-scope in-app
// operation this build doesn't provide yet.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const existing = await prisma.fixedAsset.findMany({ select: { id: true, assetCode: true } });
  const existingByCode = new Map(existing.map((a) => [a.assetCode, a.id]));
  const seenInFile = new Set<string>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const assetCode = raw.assetCode?.trim();
    const assetName = raw.assetName?.trim();
    const trackingType = raw.trackingType?.trim().toUpperCase();
    const totalQuantityRaw = raw.totalQuantity?.trim();
    const isExisting = assetCode ? existingByCode.has(assetCode) : false;

    const reasons: string[] = [];
    if (!assetCode) reasons.push("Kode aset (assetCode) wajib diisi");
    else if (seenInFile.has(assetCode)) reasons.push(`Kode aset ${assetCode} duplikat dalam berkas`);
    if (!assetName) reasons.push("Nama aset (assetName) wajib diisi");
    if (!isExisting) {
      if (!trackingType || !VALID_TRACKING_TYPES.includes(trackingType)) {
        reasons.push(`Tipe pelacakan (trackingType) harus salah satu dari: ${VALID_TRACKING_TYPES.join(", ")}`);
      }
      if (trackingType === "QUANTITY_TRACKED") {
        const qty = Number(totalQuantityRaw);
        if (!totalQuantityRaw || !Number.isFinite(qty) || qty <= 0) {
          reasons.push("Jumlah total (totalQuantity) wajib diisi dengan angka lebih dari 0 untuk aset kuantitas");
        }
      }
    }

    if (assetCode) seenInFile.add(assetCode);
    const existingId = assetCode ? existingByCode.get(assetCode) : undefined;

    return {
      rowNumber,
      raw,
      isValid: reasons.length === 0,
      rejectionReason: reasons.length > 0 ? reasons.join("; ") : null,
      action: reasons.length > 0 ? null : existingId ? "UPDATE" : "CREATE",
      existingId,
    };
  });
}

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const assetCode = raw.assetCode.trim();
  const assetName = raw.assetName.trim();
  const category = raw.category?.trim() || null;
  const purchaseDate = raw.purchaseDate?.trim() ? new Date(raw.purchaseDate.trim()) : null;
  const purchaseCost = raw.purchaseCost?.trim() ? Number(raw.purchaseCost.trim()) : null;
  const notes = raw.notes?.trim() || null;

  const existing = await prisma.fixedAsset.findUnique({ where: { assetCode } });
  if (existing) {
    await prisma.fixedAsset.update({
      where: { id: existing.id },
      data: { assetName, category, purchaseDate, purchaseCost, notes },
    });
    return { id: existing.id, action: "UPDATE" };
  }

  const trackingType = raw.trackingType.trim().toUpperCase() as AssetTrackingType;
  const totalQuantity = trackingType === "QUANTITY_TRACKED" ? Number(raw.totalQuantity.trim()) : null;

  const created = await prisma.fixedAsset.create({
    data: {
      assetCode,
      assetName,
      category,
      trackingType,
      totalQuantity,
      availableQuantity: totalQuantity,
      purchaseDate,
      purchaseCost,
      notes,
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
      trackingType: a.trackingType,
      totalQuantity: a.totalQuantity !== null ? String(a.totalQuantity) : "",
      purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
      purchaseCost: a.purchaseCost !== null ? String(a.purchaseCost) : "",
      notes: a.notes ?? "",
    })),
  };
}

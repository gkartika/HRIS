import { prisma } from "@/lib/db";
import {
  hasHeader,
  isCancelledStatus,
  parseCategory,
  parseFlexibleDate,
  parseIntStrict,
  pick,
} from "@/lib/consumable-import-parse";
import { formatCompanyDate } from "@/lib/consumables-report";
import {
  getCachedImportContext,
  importKey,
  isAlreadyImported,
  loadImportContext,
  loadImportedKeyCounts,
  resolveImportItem,
  type ImportContext,
} from "./consumable-import-context";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";

export const label = "Riwayat Stok Masuk & Penyesuaian";
// One sheet for both movement types. Jenis may be left blank: a row with a
// Stok Fisik/Selisih is read as a Penyesuaian, otherwise as Barang Masuk.
export const templateHeaders = [
  "Tanggal",
  "Kode Barang",
  "Jenis",
  "Jumlah",
  "Stok Sistem",
  "Stok Fisik",
  "Selisih",
  "Keterangan",
  "Dicatat Oleh",
  "Status",
  "Alasan Pembatalan",
];
export const templateExampleRow = {
  Tanggal: "03/10/2026",
  "Kode Barang": "APD-CONTOH-001",
  Jenis: "MASUK",
  Jumlah: "100",
  "Stok Sistem": "",
  "Stok Fisik": "",
  Selisih: "",
  Keterangan: "PO-0412",
  "Dicatat Oleh": "",
  Status: "Aktif",
  "Alasan Pembatalan": "",
};

interface ParsedStockRow {
  itemId: string;
  type: "RECEIPT" | "ADJUSTMENT";
  occurredAt: Date;
  delta: number;
  systemStock: number | null;
  physicalStock: number | null;
  text: string | null; // PO reference for a receipt, reason for an adjustment
  recordedByLabel: string | null;
  cancelled: boolean;
  cancelReason: string | null;
}

function parseStockRow(raw: Record<string, string>, ctx: ImportContext): { row: ParsedStockRow } | { error: string } {
  const occurredAt = parseFlexibleDate(pick(raw, "Tanggal", "date"));
  if (!occurredAt) return { error: "Tanggal tidak valid (format dd/mm/yyyy)" };

  const found = resolveImportItem(ctx, pick(raw, "Kode Barang", "Kode", "itemCode"), pick(raw, "Nama Barang", "Barang"), parseCategory(pick(raw, "Kategori")));
  if ("error" in found) return { error: found.error };

  const jenis = pick(raw, "Jenis", "Tipe", "type").toUpperCase();
  const isAdjustment =
    /ADJ|PENYESUAIAN|OPNAME/.test(jenis) || (!jenis && hasHeader(raw, "Stok Fisik", "Selisih") && !!(pick(raw, "Stok Fisik") || pick(raw, "Selisih")));
  const isReceipt = /MASUK|^IN$|RECEIPT/.test(jenis) || (!jenis && !isAdjustment);
  if (!isAdjustment && !isReceipt) return { error: `Jenis "${jenis}" tidak dikenal (gunakan MASUK atau PENYESUAIAN)` };

  const status = pick(raw, "Status");
  const common = {
    itemId: found.item.id,
    occurredAt,
    recordedByLabel: pick(raw, "Dicatat Oleh", "Dicatat", "dicatatOleh") || null,
    cancelled: isCancelledStatus(status),
    cancelReason: pick(raw, "Alasan Pembatalan", "Dibatalkan Alasan", "dibatalkan_alasan") || null,
  };

  if (isAdjustment) {
    const diffRaw = pick(raw, "Selisih");
    const systemRaw = pick(raw, "Stok Sistem");
    const physicalRaw = pick(raw, "Stok Fisik");
    const system = systemRaw ? parseIntStrict(systemRaw) : null;
    const physical = physicalRaw ? parseIntStrict(physicalRaw) : null;
    if ((systemRaw && system === null) || (physicalRaw && physical === null)) return { error: "Stok Sistem/Stok Fisik harus bilangan bulat" };

    let delta: number | null = null;
    if (diffRaw) {
      delta = parseIntStrict(diffRaw);
      if (delta === null) return { error: "Selisih harus bilangan bulat" };
    } else if (system !== null && physical !== null) {
      delta = physical - system;
    }
    if (delta === null) return { error: "Penyesuaian butuh kolom Selisih, atau Stok Sistem dan Stok Fisik" };
    if (delta === 0) return { error: "Selisih nol: tidak ada penyesuaian yang perlu dicatat" };
    return {
      row: {
        ...common,
        type: "ADJUSTMENT",
        delta,
        systemStock: system,
        physicalStock: physical,
        text: pick(raw, "Alasan", "Keterangan", "reason") || null,
      },
    };
  }

  const qty = parseIntStrict(pick(raw, "Jumlah", "Jumlah Masuk", "quantity").replace(/^\+/, ""));
  if (qty === null || qty <= 0) return { error: "Jumlah masuk harus bilangan bulat lebih dari 0" };
  return {
    row: { ...common, type: "RECEIPT", delta: qty, systemStock: null, physicalStock: null, text: pick(raw, "Keterangan", "Referensi", "reference") || null },
  };
}

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const ctx = await loadImportContext();
  const [receiptCounts, adjustmentCounts] = await Promise.all([loadImportedKeyCounts("RECEIPT"), loadImportedKeyCounts("ADJUSTMENT")]);
  const seen = new Map<string, number>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const parsed = parseStockRow(raw, ctx);
    if ("error" in parsed) return { rowNumber, raw, isValid: false, rejectionReason: parsed.error, action: null };
    const r = parsed.row;
    const key = importKey(r.type, r.itemId, r.occurredAt, r.delta, null);
    const counts = r.type === "RECEIPT" ? receiptCounts : adjustmentCounts;
    if (isAlreadyImported(counts, seen, key)) {
      return { rowNumber, raw, isValid: false, rejectionReason: `Sudah pernah diimpor (${formatCompanyDate(r.occurredAt)}, ${r.delta > 0 ? "+" : ""}${r.delta})`, action: null };
    }
    return {
      rowNumber,
      raw,
      isValid: true,
      rejectionReason: r.cancelled ? "Ditandai Dibatalkan di sistem lama: diimpor sebagai transaksi dibatalkan." : null,
      action: "CREATE" as const,
    };
  });
}

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const parsed = parseStockRow(raw, await getCachedImportContext());
  if ("error" in parsed) throw new Error(parsed.error);
  const r = parsed.row;
  const created = await prisma.consumableTransaction.create({
    data: {
      itemId: r.itemId,
      type: r.type,
      quantityDelta: r.delta,
      occurredAt: r.occurredAt,
      source: "IMPORT",
      reference: r.type === "RECEIPT" ? r.text : null,
      reason: r.type === "ADJUSTMENT" ? r.text : null,
      systemStockSnapshot: r.systemStock,
      physicalStock: r.physicalStock,
      recordedByAccountId: session!.user.id,
      recordedByLabel: r.recordedByLabel,
      ...(r.cancelled
        ? {
            cancelledAt: new Date(),
            cancelledByAccountId: session!.user.id,
            cancelReason: r.cancelReason ?? "Dibatalkan di sistem lama",
          }
        : {}),
    },
  });
  return { id: created.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const rows = await prisma.consumableTransaction.findMany({
    where: { type: { in: ["RECEIPT", "ADJUSTMENT"] } },
    orderBy: { occurredAt: "asc" },
    include: { item: true },
  });
  return {
    headers: templateHeaders,
    rows: rows.map((r) => ({
      Tanggal: formatCompanyDate(r.occurredAt),
      "Kode Barang": r.item.itemCode,
      Jenis: r.type === "RECEIPT" ? "MASUK" : "PENYESUAIAN",
      Jumlah: r.type === "RECEIPT" ? String(r.quantityDelta) : "",
      "Stok Sistem": r.systemStockSnapshot !== null ? String(r.systemStockSnapshot) : "",
      "Stok Fisik": r.physicalStock !== null ? String(r.physicalStock) : "",
      Selisih: r.type === "ADJUSTMENT" ? String(r.quantityDelta) : "",
      Keterangan: (r.type === "RECEIPT" ? r.reference : r.reason) ?? "",
      "Dicatat Oleh": r.recordedByLabel ?? "",
      Status: r.cancelledAt ? "Dibatalkan" : "Aktif",
      "Alasan Pembatalan": r.cancelReason ?? "",
    })),
  };
}

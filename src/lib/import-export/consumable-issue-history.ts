import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/name-match";
import {
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

export const label = "Riwayat Pengambilan Barang (Logbook)";
// Same columns as the old inventory system's logbook.
export const templateHeaders = [
  "Tanggal",
  "Nama Karyawan",
  "Departemen",
  "Kode Barang",
  "Barang",
  "Kategori",
  "Jumlah",
  "Keperluan",
  "Dicatat Oleh",
  "Status",
  "Alasan Pembatalan",
];
export const templateExampleRow = {
  Tanggal: "02/10/2026",
  "Nama Karyawan": "Nama Karyawan Contoh",
  Departemen: "Produksi",
  "Kode Barang": "APD-CONTOH-001",
  Barang: "Masker KN95",
  Kategori: "APD",
  Jumlah: "2",
  Keperluan: "",
  "Dicatat Oleh": "",
  Status: "Aktif",
  "Alasan Pembatalan": "",
};

interface ParsedIssueRow {
  itemId: string;
  occurredAt: Date;
  quantity: number;
  nameText: string;
  employeeId: string | null;
  employeeName: string | null;
  department: string | null;
  purpose: string | null;
  recordedByLabel: string | null;
  cancelled: boolean;
  cancelReason: string | null;
}

function parseIssueRow(raw: Record<string, string>, ctx: ImportContext): { row: ParsedIssueRow } | { error: string } {
  const occurredAt = parseFlexibleDate(pick(raw, "Tanggal", "date"));
  if (!occurredAt) return { error: "Tanggal tidak valid (format dd/mm/yyyy)" };

  const nameText = pick(raw, "Nama Karyawan", "Karyawan", "Nama Pengambil", "Pengambil", "Nama");
  if (!nameText) return { error: "Nama Karyawan wajib diisi" };

  const qty = parseIntStrict(pick(raw, "Jumlah", "Jumlah Keluar", "quantity").replace(/^\+/, ""));
  if (qty === null || qty <= 0) return { error: "Jumlah harus bilangan bulat lebih dari 0" };

  const found = resolveImportItem(
    ctx,
    pick(raw, "Kode Barang", "Kode", "itemCode"),
    pick(raw, "Barang", "Nama Barang"),
    parseCategory(pick(raw, "Kategori"))
  );
  if ("error" in found) return { error: found.error };

  // A name that matches exactly one employee is linked; an unknown or shared
  // name is kept as plain text, so no history is dropped or mis-attributed.
  const employeeId = ctx.employeeIdByName.get(normalizeName(nameText)) ?? null;
  return {
    row: {
      itemId: found.item.id,
      occurredAt,
      quantity: qty,
      nameText,
      employeeId,
      employeeName: employeeId ? (ctx.employeeNameById.get(employeeId) ?? null) : null,
      department: pick(raw, "Departemen", "Department") || null,
      purpose: pick(raw, "Keperluan", "Keterangan", "purpose") || null,
      recordedByLabel: pick(raw, "Dicatat Oleh", "Dicatat", "dicatatOleh") || null,
      cancelled: isCancelledStatus(pick(raw, "Status")),
      cancelReason: pick(raw, "Alasan Pembatalan", "Dibatalkan Alasan", "dibatalkan_alasan") || null,
    },
  };
}

export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const ctx = await loadImportContext();
  const existing = await loadImportedKeyCounts("ISSUE");
  const seen = new Map<string, number>();

  return rows.map((raw, index) => {
    const rowNumber = index + 2;
    const parsed = parseIssueRow(raw, ctx);
    if ("error" in parsed) return { rowNumber, raw, isValid: false, rejectionReason: parsed.error, action: null };
    const r = parsed.row;
    const key = importKey("ISSUE", r.itemId, r.occurredAt, -r.quantity, r.employeeName ?? r.nameText);
    if (isAlreadyImported(existing, seen, key)) {
      return { rowNumber, raw, isValid: false, rejectionReason: `Sudah pernah diimpor (${formatCompanyDate(r.occurredAt)}, ${r.nameText})`, action: null };
    }
    const notes: string[] = [];
    if (!r.employeeId) notes.push(`Nama "${r.nameText}" tidak cocok dengan satu karyawan: disimpan sebagai teks.`);
    if (r.cancelled) notes.push("Ditandai Dibatalkan di sistem lama: diimpor sebagai transaksi dibatalkan.");
    return { rowNumber, raw, isValid: true, rejectionReason: notes.length ? notes.join(" ") : null, action: "CREATE" as const };
  });
}

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const parsed = parseIssueRow(raw, await getCachedImportContext());
  if ("error" in parsed) throw new Error(parsed.error);
  const r = parsed.row;
  const created = await prisma.consumableTransaction.create({
    data: {
      itemId: r.itemId,
      type: "ISSUE",
      quantityDelta: -r.quantity,
      occurredAt: r.occurredAt,
      source: "IMPORT",
      recipientType: "EMPLOYEE",
      employeeId: r.employeeId,
      recipientNameSnapshot: r.employeeName ?? r.nameText,
      departmentNameSnapshot: r.department,
      purpose: r.purpose,
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
    where: { type: "ISSUE" },
    orderBy: { occurredAt: "asc" },
    include: { item: true },
  });
  return {
    headers: templateHeaders,
    rows: rows.map((r) => ({
      Tanggal: formatCompanyDate(r.occurredAt),
      "Nama Karyawan": r.recipientNameSnapshot ?? "",
      Departemen: r.departmentNameSnapshot ?? "",
      "Kode Barang": r.item.itemCode,
      Barang: r.item.itemName,
      Kategori: r.item.category,
      Jumlah: String(Math.abs(r.quantityDelta)),
      Keperluan: r.purpose ?? "",
      "Dicatat Oleh": r.recordedByLabel ?? "",
      Status: r.cancelledAt ? "Dibatalkan" : "Aktif",
      "Alasan Pembatalan": r.cancelReason ?? "",
    })),
  };
}

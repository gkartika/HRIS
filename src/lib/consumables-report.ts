// Pure report/aggregation builders for consumables — no Prisma/xlsx imports,
// so the figures are unit-testable (same pattern as
// attendance-reconciliation-export.ts). All month boundaries are company
// (WIB, fixed +07:00) calendar months.
import { companyDateParts, WIB_OFFSET_MS } from "@/lib/company-time";


export interface ReportItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  openingStock: number;
  minStock: number;
}

export interface ReportLedgerRow {
  itemId: string;
  type: "ISSUE" | "RECEIPT" | "ADJUSTMENT";
  quantityDelta: number;
  occurredAt: Date;
}

export interface MonthlyReportRow {
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  opening: number;
  received: number;
  issued: number; // positive units taken out
  adjusted: number; // signed
  closing: number;
}

export function monthKey(date: Date): string {
  const { year, month } = companyDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

// "2026-10" -> [00:00 WIB 1 Oct, 00:00 WIB 1 Nov). null for malformed input.
export function monthRange(key: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - WIB_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - WIB_OFFSET_MS),
  };
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

// Awal = opening stock + everything before the month; Akhir = Awal + the
// month's movements. Rows are expected to be non-cancelled only.
export function buildMonthlyReport(
  items: ReportItem[],
  rows: ReportLedgerRow[],
  range: { start: Date; end: Date }
): MonthlyReportRow[] {
  const byItem = new Map<string, ReportLedgerRow[]>();
  for (const r of rows) {
    const list = byItem.get(r.itemId) ?? [];
    list.push(r);
    byItem.set(r.itemId, list);
  }

  const out: MonthlyReportRow[] = [];
  for (const item of items) {
    let opening = item.openingStock;
    let received = 0;
    let issued = 0;
    let adjusted = 0;
    for (const r of byItem.get(item.id) ?? []) {
      if (r.occurredAt < range.start) opening += r.quantityDelta;
      else if (r.occurredAt < range.end) {
        if (r.type === "RECEIPT") received += r.quantityDelta;
        else if (r.type === "ISSUE") issued += -r.quantityDelta;
        else adjusted += r.quantityDelta;
      }
    }
    const closing = opening + received - issued + adjusted;
    if (opening === 0 && received === 0 && issued === 0 && adjusted === 0 && closing === 0) continue;
    out.push({
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      opening,
      received,
      issued,
      adjusted,
      closing,
    });
  }
  return out;
}

// Same result as buildMonthlyReport, but from aggregates the database already
// summed: `before` = per-item sum of every movement before the month,
// `within` = per-item, per-type sums inside it. No ledger rows are read.
export interface WithinSum {
  itemId: string;
  type: "ISSUE" | "RECEIPT" | "ADJUSTMENT";
  sum: number;
}
export function buildMonthlyReportFromSums(
  items: ReportItem[],
  before: Map<string, number>,
  within: WithinSum[]
): MonthlyReportRow[] {
  const byItem = new Map<string, WithinSum[]>();
  for (const w of within) byItem.set(w.itemId, [...(byItem.get(w.itemId) ?? []), w]);
  const out: MonthlyReportRow[] = [];
  for (const item of items) {
    const opening = item.openingStock + (before.get(item.id) ?? 0);
    let received = 0;
    let issued = 0;
    let adjusted = 0;
    for (const w of byItem.get(item.id) ?? []) {
      if (w.type === "RECEIPT") received += w.sum;
      else if (w.type === "ISSUE") issued += -w.sum;
      else adjusted += w.sum;
    }
    const closing = opening + received - issued + adjusted;
    if (opening === 0 && received === 0 && issued === 0 && adjusted === 0 && closing === 0) continue;
    out.push({ itemCode: item.itemCode, itemName: item.itemName, category: item.category, unit: item.unit, opening, received, issued, adjusted, closing });
  }
  return out;
}

export const MONTHLY_REPORT_HEADERS = ["No", "Kode", "Barang", "Kategori", "Satuan", "Stok Awal", "Masuk", "Keluar", "Penyesuaian", "Stok Akhir"];

export function buildMonthlyReportSheet(rows: MonthlyReportRow[]): (string | number)[][] {
  return [
    MONTHLY_REPORT_HEADERS,
    ...rows.map((r, i) => [i + 1, r.itemCode, r.itemName, r.category, r.unit, r.opening, r.received, r.issued, r.adjusted, r.closing]),
  ];
}

export function formatCompanyDate(date: Date): string {
  const { year, month, day } = companyDateParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export interface HistoryExportRow {
  occurredAt: Date;
  type: "ISSUE" | "RECEIPT" | "ADJUSTMENT";
  quantityDelta: number;
  itemCode: string;
  itemName: string;
  unit: string;
  recipientName: string | null;
  departmentName: string | null;
  recipientType: "EMPLOYEE" | "DEPARTMENT" | null;
  purpose: string | null;
  warningReason: string | null;
  beforePeriod: boolean;
  exceededStock: boolean;
  reference: string | null;
  note: string | null;
  systemStockSnapshot: number | null;
  physicalStock: number | null;
  reason: string | null;
  recordedByLabel: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

// Same columns as the Riwayat tab it was exported from, plus who recorded it.
export function buildHistorySheet(type: "ISSUE" | "RECEIPT" | "ADJUSTMENT", rows: HistoryExportRow[]): (string | number)[][] {
  const status = (r: HistoryExportRow) => (r.cancelledAt ? `Dibatalkan: ${r.cancelReason ?? ""}`.trim() : "Aktif");
  if (type === "ISSUE") {
    return [
      ["Tanggal", "Pengambil", "Jenis", "Departemen", "Kode", "Barang", "Jumlah", "Satuan", "Keperluan", "Peringatan", "Alasan peringatan", "Dicatat oleh", "Status"],
      ...rows.map((r) => [
        formatCompanyDate(r.occurredAt),
        r.recipientName ?? "",
        r.recipientType === "DEPARTMENT" ? "Departemen" : "Karyawan",
        r.departmentName ?? "",
        r.itemCode,
        r.itemName,
        Math.abs(r.quantityDelta),
        r.unit,
        r.purpose ?? "",
        [r.beforePeriod ? "Sebelum periode" : "", r.exceededStock ? "Melebihi stok" : ""].filter(Boolean).join(", "),
        r.warningReason ?? "",
        r.recordedByLabel ?? "",
        status(r),
      ]),
    ];
  }
  if (type === "RECEIPT") {
    return [
      ["Tanggal", "Kode", "Barang", "Jumlah", "Satuan", "Keterangan / PO", "Catatan", "Dicatat oleh", "Status"],
      ...rows.map((r) => [
        formatCompanyDate(r.occurredAt),
        r.itemCode,
        r.itemName,
        r.quantityDelta,
        r.unit,
        r.reference ?? "",
        r.note ?? "",
        r.recordedByLabel ?? "",
        status(r),
      ]),
    ];
  }
  return [
    ["Tanggal", "Kode", "Barang", "Stok sistem", "Stok fisik", "Selisih", "Satuan", "Alasan", "Dicatat oleh", "Status"],
    ...rows.map((r) => [
      formatCompanyDate(r.occurredAt),
      r.itemCode,
      r.itemName,
      r.systemStockSnapshot ?? "",
      r.physicalStock ?? "",
      r.quantityDelta,
      r.unit,
      r.reason ?? "",
      r.recordedByLabel ?? "",
      status(r),
    ]),
  ];
}

// Same buckets as bucketMonthlyIssued, from rows the database already grouped
// by (WIB month key, category).
export interface MonthlyIssueAggregate {
  key: string;
  category: string;
  units: number;
}
export function bucketFromAggregates(rows: MonthlyIssueAggregate[], months: number, now: Date = new Date()): MonthlyIssueBucket[] {
  const buckets = bucketMonthlyIssued([], months, now);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const r of rows) {
    const bucket = byKey.get(r.key);
    if (!bucket) continue;
    if (r.category === "APD") bucket.APD += r.units;
    else if (r.category === "ATK") bucket.ATK += r.units;
  }
  return buckets;
}

export interface MonthlyIssueBucket {
  key: string;
  APD: number;
  ATK: number;
}

// Units taken out per month and category for the last `months` months ending
// at `now`, oldest first, with empty months kept so the chart has no gaps.
export function bucketMonthlyIssued(
  rows: { occurredAt: Date; quantityDelta: number; category: string }[],
  months: number,
  now: Date = new Date()
): MonthlyIssueBucket[] {
  const { year, month } = companyDateParts(now);
  const buckets: MonthlyIssueBucket[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    buckets.push({ key: `${y}-${String(m).padStart(2, "0")}`, APD: 0, ATK: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const r of rows) {
    const bucket = byKey.get(monthKey(r.occurredAt));
    if (!bucket) continue;
    const units = -r.quantityDelta;
    if (r.category === "APD") bucket.APD += units;
    else if (r.category === "ATK") bucket.ATK += units;
  }
  return buckets;
}

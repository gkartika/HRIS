import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getActiveSession } from "@/lib/require-session";
import { canManageConsumables } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildHistoryWhere, listItemsWithStock } from "@/lib/consumables-queries";
import {
  buildHistorySheet,
  buildMonthlyReport,
  buildMonthlyReportSheet,
  monthKey,
  monthRange,
} from "@/lib/consumables-report";
import type { ConsumableTxType } from "@/generated/prisma/enums";

// GA-Admin-only Excel export for the consumables module. One endpoint:
//   ?type=stock                       current stock per item
//   ?type=keluar|masuk|adj[&q&status] the Riwayat tab with its current filters
//   ?type=report[&month=YYYY-MM]      monthly report (Awal/Masuk/Keluar/Penyesuaian/Akhir)
const HISTORY_TYPES: Record<string, ConsumableTxType> = { keluar: "ISSUE", masuk: "RECEIPT", adj: "ADJUSTMENT" };

export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageConsumables(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";

  let sheet: (string | number)[][];
  let sheetName: string;
  let filename: string;
  let rowCount: number;

  if (type === "stock") {
    const items = await listItemsWithStock({ includeArchived: true });
    sheet = [
      ["Kode", "Barang", "Kategori", "Satuan", "Stok Awal", "Masuk", "Keluar", "Penyesuaian", "Sisa", "Min", "Status", "Diarsipkan"],
      ...items.map((i) => [
        i.itemCode,
        i.itemName,
        i.category,
        i.unit,
        i.openingStock,
        i.totals.received,
        i.totals.issued,
        i.totals.adjusted,
        i.stock,
        i.minStock,
        i.status,
        i.archived ? "Ya" : "",
      ]),
    ];
    sheetName = "Stok";
    filename = "stok-barang-habis-pakai.xlsx";
    rowCount = items.length;
  } else if (type in HISTORY_TYPES) {
    const txType = HISTORY_TYPES[type];
    const rows = await prisma.consumableTransaction.findMany({
      where: buildHistoryWhere(txType, searchParams.get("q") ?? undefined, searchParams.get("status") ?? undefined),
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { item: true },
    });
    sheet = buildHistorySheet(
      txType,
      rows.map((r) => ({
        occurredAt: r.occurredAt,
        type: r.type,
        quantityDelta: r.quantityDelta,
        itemCode: r.item.itemCode,
        itemName: r.item.itemName,
        unit: r.item.unit,
        recipientName: r.recipientNameSnapshot,
        departmentName: r.departmentNameSnapshot,
        recipientType: r.recipientType,
        purpose: r.purpose,
        warningReason: r.warningReason,
        beforePeriod: r.beforePeriod,
        exceededStock: r.exceededStock,
        reference: r.reference,
        note: r.note,
        systemStockSnapshot: r.systemStockSnapshot,
        physicalStock: r.physicalStock,
        reason: r.reason,
        recordedByLabel: r.recordedByLabel,
        cancelledAt: r.cancelledAt,
        cancelReason: r.cancelReason,
      }))
    );
    sheetName = { keluar: "Barang Keluar", masuk: "Barang Masuk", adj: "Penyesuaian" }[type]!;
    filename = `riwayat-${type}.xlsx`;
    rowCount = rows.length;
  } else if (type === "report") {
    const key = searchParams.get("month") ?? monthKey(new Date());
    const range = monthRange(key);
    if (!range) return NextResponse.json({ error: "Bulan tidak valid (format YYYY-MM)." }, { status: 400 });
    const [items, ledger] = await Promise.all([
      prisma.consumableItem.findMany({ orderBy: [{ category: "asc" }, { itemCode: "asc" }] }),
      prisma.consumableTransaction.findMany({
        where: { cancelledAt: null, occurredAt: { lt: range.end } },
        select: { itemId: true, type: true, quantityDelta: true, occurredAt: true },
      }),
    ]);
    const report = buildMonthlyReport(items, ledger, range);
    sheet = buildMonthlyReportSheet(report);
    sheetName = "Laporan Bulanan";
    filename = `laporan-barang-habis-pakai-${key}.xlsx`;
    rowCount = report.length;
  } else {
    return NextResponse.json({ error: "Jenis ekspor tidak dikenal." }, { status: 400 });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet), sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "ConsumableTransaction",
    reason: `Exported consumables ${type} (${rowCount} row(s))`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

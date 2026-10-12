// Prisma-backed reads for the consumables ledger. Stock is always derived
// here from openingStock + non-cancelled ledger rows; nothing is stored.
import { activeAssignmentWhere } from "@/lib/active-assignments";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ConsumableCategory, ConsumableTxType } from "@/generated/prisma/enums";
import { nameSearchWords, stockStatus, type ConsumableStatusValue } from "@/lib/consumables";
import { resolveOrgUnitAncestorChain } from "@/lib/level3-scope";
import { buildMonthlyReportFromSums, bucketFromAggregates, type MonthlyIssueBucket, type MonthlyReportRow } from "@/lib/consumables-report";

type Db = Pick<typeof prisma, "consumableTransaction"> | Prisma.TransactionClient;

export interface ItemMovementTotals {
  received: number;
  issued: number; // positive number of units taken out
  adjusted: number; // signed
}

export interface ItemWithStock {
  id: string;
  itemCode: string;
  itemName: string;
  category: ConsumableCategory;
  unit: string;
  openingStock: number;
  minStock: number;
  replacementPeriodMonths: number;
  archived: boolean;
  totals: ItemMovementTotals;
  stock: number;
  status: ConsumableStatusValue;
}

// One grouped query for every item's non-cancelled movement totals.
export async function getMovementTotals(db: Db = prisma, itemIds?: string[]): Promise<Map<string, ItemMovementTotals>> {
  const groups = await db.consumableTransaction.groupBy({
    by: ["itemId", "type"],
    where: { cancelledAt: null, ...(itemIds ? { itemId: { in: itemIds } } : {}) },
    _sum: { quantityDelta: true },
  });
  const map = new Map<string, ItemMovementTotals>();
  for (const g of groups) {
    const totals = map.get(g.itemId) ?? { received: 0, issued: 0, adjusted: 0 };
    const sum = g._sum.quantityDelta ?? 0;
    if (g.type === "RECEIPT") totals.received += sum;
    else if (g.type === "ISSUE") totals.issued += -sum;
    else totals.adjusted += sum;
    map.set(g.itemId, totals);
  }
  return map;
}

export function stockFromTotals(openingStock: number, totals: ItemMovementTotals | undefined): number {
  if (!totals) return openingStock;
  return openingStock + totals.received - totals.issued + totals.adjusted;
}

export async function listItemsWithStock(opts: {
  includeArchived?: boolean;
  category?: ConsumableCategory;
  q?: string;
} = {}): Promise<ItemWithStock[]> {
  const where: Prisma.ConsumableItemWhereInput = {};
  if (!opts.includeArchived) where.archived = false;
  if (opts.category) where.category = opts.category;
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { itemCode: { contains: q, mode: "insensitive" } },
      { itemName: { contains: q, mode: "insensitive" } },
    ];
  }
  const items = await prisma.consumableItem.findMany({ where, orderBy: [{ category: "asc" }, { itemCode: "asc" }] });
  const totals = await getMovementTotals(prisma, items.map((i) => i.id));
  return items.map((item) => {
    const t = totals.get(item.id) ?? { received: 0, issued: 0, adjusted: 0 };
    const stock = stockFromTotals(item.openingStock, t);
    return { ...item, totals: t, stock, status: stockStatus(stock, item.minStock) };
  });
}

// Barang Keluar: who took it. Every word typed must appear somewhere in the
// taker's name as saved on the transaction, the employee's current name, their
// NIP or the department it was issued to, so "santoso budi" finds "BUDI SANTOSO"
// and a part of the NIP or department works too.
function takerMatch(query: string): Prisma.ConsumableTransactionWhereInput[] {
  const words = nameSearchWords(query);
  return [
    {
      AND: words.map((word) => ({
        OR: [
          { recipientNameSnapshot: { contains: word, mode: "insensitive" as const } },
          { departmentNameSnapshot: { contains: word, mode: "insensitive" as const } },
          { employee: { fullLegalName: { contains: word, mode: "insensitive" as const } } },
          { employee: { employeeNumber: { contains: word, mode: "insensitive" as const } } },
        ],
      })),
    },
  ];
}

// One filter for the Riwayat screen and its Excel export, so the export always
// contains exactly the rows on screen. Barang Keluar searches the taker or the
// item; Masuk/Penyesuaian have no taker, so they search the item only.
export function buildHistoryWhere(
  type: ConsumableTxType,
  q: string | undefined,
  status: string | undefined
): Prisma.ConsumableTransactionWhereInput {
  const where: Prisma.ConsumableTransactionWhereInput = { type };
  if (status === "Aktif") where.cancelledAt = null;
  if (status === "Dibatalkan") where.cancelledAt = { not: null };
  const query = q?.trim();
  if (query) {
    const itemMatch: Prisma.ConsumableTransactionWhereInput[] = [
      { item: { itemName: { contains: query, mode: "insensitive" } } },
      { item: { itemCode: { contains: query, mode: "insensitive" } } },
    ];
    where.OR = type === "ISSUE" ? [...takerMatch(query), ...itemMatch] : itemMatch;
  }
  return where;
}

export interface EmployeeOrgInfo {
  departmentName: string | null;
  positionTitle: string | null;
}

// Department + position of each employee's current assignment, for the take
// screen and for the name snapshots stored on an ISSUE row. One assignment
// query for the whole batch; the org tree comes from the per-request cache.
export async function getEmployeeOrgInfo(employeeIds: string[]): Promise<Map<string, EmployeeOrgInfo>> {
  const map = new Map<string, EmployeeOrgInfo>();
  if (employeeIds.length === 0) return map;
  const now = new Date();
  const assignments = await prisma.assignment.findMany({
    where: {
      employeeId: { in: employeeIds },
      ...activeAssignmentWhere(now),
    },
    include: { position: { include: { job: true } } },
    orderBy: [{ primaryAssignmentFlag: "desc" }, { effectiveFrom: "asc" }],
  });
  for (const a of assignments) {
    if (map.has(a.employeeId)) continue;
    const chain = await resolveOrgUnitAncestorChain(a.position.orgUnitId);
    const department = chain.find((u) => u.unitType === "DEPARTMENT") ?? chain[0];
    map.set(a.employeeId, { departmentName: department?.unitName ?? null, positionTitle: a.position.job.jobTitle });
  }
  return map;
}

// Monthly report straight from the database: per-item sums before the month
// and inside it, instead of reading every ledger row up to the month's end.
export async function getMonthlyReportRows(range: { start: Date; end: Date }): Promise<MonthlyReportRow[]> {
  const [items, beforeGroups, withinGroups] = await Promise.all([
    prisma.consumableItem.findMany({
      orderBy: [{ category: "asc" }, { itemCode: "asc" }],
      select: { id: true, itemCode: true, itemName: true, category: true, unit: true, openingStock: true, minStock: true },
    }),
    prisma.consumableTransaction.groupBy({
      by: ["itemId"],
      where: { cancelledAt: null, occurredAt: { lt: range.start } },
      _sum: { quantityDelta: true },
    }),
    prisma.consumableTransaction.groupBy({
      by: ["itemId", "type"],
      where: { cancelledAt: null, occurredAt: { gte: range.start, lt: range.end } },
      _sum: { quantityDelta: true },
    }),
  ]);
  return buildMonthlyReportFromSums(
    items,
    new Map(beforeGroups.map((g) => [g.itemId, g._sum.quantityDelta ?? 0])),
    withinGroups.map((g) => ({ itemId: g.itemId, type: g.type, sum: g._sum.quantityDelta ?? 0 }))
  );
}

// Units issued per WIB month and category since `windowStart`, grouped in SQL.
export async function getMonthlyIssued(windowStart: Date, months: number, now: Date = new Date()): Promise<MonthlyIssueBucket[]> {
  const rows = await prisma.$queryRaw<{ key: string; category: string; units: number }[]>`
    SELECT to_char(date_trunc('month', (t."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS key,
           i."category"::text AS category,
           (-SUM(t."quantityDelta"))::int AS units
    FROM "ConsumableTransaction" t
    JOIN "ConsumableItem" i ON i."id" = t."itemId"
    WHERE t."type" = 'ISSUE' AND t."cancelledAt" IS NULL AND t."occurredAt" >= ${windowStart}
    GROUP BY 1, 2`;
  return bucketFromAggregates(rows.map((r) => ({ key: r.key, category: r.category, units: Number(r.units) })), months, now);
}

// Live stock of a single item, read inside a transaction when the caller is
// about to write (Opname delta, over-take check).
export async function getItemStock(db: Db, itemId: string, openingStock: number): Promise<number> {
  const totals = await getMovementTotals(db, [itemId]);
  return stockFromTotals(openingStock, totals.get(itemId));
}

// Most recent non-cancelled ISSUE of each item to one employee — drives the
// replacement-period warning.
export async function getLastIssueDates(db: Db, employeeId: string, itemIds: string[]): Promise<Map<string, Date>> {
  const rows = await db.consumableTransaction.groupBy({
    by: ["itemId"],
    where: { type: "ISSUE", employeeId, cancelledAt: null, itemId: { in: itemIds } },
    _max: { occurredAt: true },
  });
  const map = new Map<string, Date>();
  for (const r of rows) if (r._max.occurredAt) map.set(r.itemId, r._max.occurredAt);
  return map;
}

import { describe, expect, it } from "vitest";
import {
  bucketFromAggregates,
  bucketMonthlyIssued,
  buildMonthlyReport,
  buildMonthlyReportFromSums,
  buildMonthlyReportSheet,
  monthKey,
  monthRange,
  type ReportLedgerRow,
  type WithinSum,
} from "./consumables-report";

const wib = (y: number, m: number, d: number, hour = 12) => new Date(Date.UTC(y, m - 1, d, hour - 7));

const item = (id: string, openingStock = 0) => ({
  id,
  itemCode: id.toUpperCase(),
  itemName: `Item ${id}`,
  category: "APD",
  unit: "pcs",
  openingStock,
  minStock: 0,
});

describe("monthRange / monthKey", () => {
  it("uses WIB month boundaries", () => {
    const r = monthRange("2026-10")!;
    expect(r.start).toEqual(wib(2026, 10, 1, 0));
    expect(r.end).toEqual(wib(2026, 11, 1, 0));
  });
  it("rejects malformed keys", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("oct")).toBeNull();
  });
  it("buckets by the WIB day, not the UTC day", () => {
    // 00:30 WIB on 1 Nov is still 31 Oct in UTC.
    expect(monthKey(new Date(Date.UTC(2026, 9, 31, 17, 30)))).toBe("2026-11");
    expect(monthKey(new Date(Date.UTC(2026, 9, 31, 16, 30)))).toBe("2026-10");
  });
});

describe("buildMonthlyReport", () => {
  const range = monthRange("2026-10")!;

  it("carries earlier movements into the opening balance", () => {
    const rows = buildMonthlyReport(
      [item("a", 10)],
      [
        { itemId: "a", type: "RECEIPT", quantityDelta: 100, occurredAt: wib(2026, 9, 5) },
        { itemId: "a", type: "ISSUE", quantityDelta: -30, occurredAt: wib(2026, 9, 20) },
        { itemId: "a", type: "ISSUE", quantityDelta: -4, occurredAt: wib(2026, 10, 2) },
        { itemId: "a", type: "RECEIPT", quantityDelta: 20, occurredAt: wib(2026, 10, 10) },
        { itemId: "a", type: "ADJUSTMENT", quantityDelta: -5, occurredAt: wib(2026, 10, 28) },
        { itemId: "a", type: "ISSUE", quantityDelta: -9, occurredAt: wib(2026, 11, 3) },
      ],
      range
    );
    expect(rows).toEqual([
      expect.objectContaining({ opening: 80, received: 20, issued: 4, adjusted: -5, closing: 91 }),
    ]);
  });

  it("skips an item with nothing at all", () => {
    expect(buildMonthlyReport([item("a", 0)], [], range)).toEqual([]);
  });

  it("keeps an item that only has an opening balance", () => {
    expect(buildMonthlyReport([item("a", 7)], [], range)[0]).toMatchObject({ opening: 7, closing: 7 });
  });

  it("builds a sheet with a header row", () => {
    const sheet = buildMonthlyReportSheet(buildMonthlyReport([item("a", 7)], [], range));
    expect(sheet[0][0]).toBe("No");
    expect(sheet[1]).toEqual([1, "A", "Item a", "APD", "pcs", 7, 0, 0, 0, 7]);
  });
});

// The database-aggregated builders must give exactly the figures of the
// row-by-row builders they replaced.
describe("aggregate builders match the row builders", () => {
  const range = monthRange("2026-10")!;
  const ledger: ReportLedgerRow[] = [
    { itemId: "a", type: "RECEIPT", quantityDelta: 100, occurredAt: wib(2026, 9, 5) },
    { itemId: "a", type: "ISSUE", quantityDelta: -30, occurredAt: wib(2026, 9, 20) },
    { itemId: "a", type: "ISSUE", quantityDelta: -4, occurredAt: wib(2026, 10, 2) },
    { itemId: "a", type: "ISSUE", quantityDelta: -6, occurredAt: wib(2026, 10, 9) },
    { itemId: "a", type: "RECEIPT", quantityDelta: 20, occurredAt: wib(2026, 10, 10) },
    { itemId: "a", type: "ADJUSTMENT", quantityDelta: -5, occurredAt: wib(2026, 10, 28) },
    { itemId: "a", type: "ISSUE", quantityDelta: -9, occurredAt: wib(2026, 11, 3) },
    { itemId: "b", type: "ISSUE", quantityDelta: -2, occurredAt: wib(2026, 10, 1, 0) },
    { itemId: "c", type: "RECEIPT", quantityDelta: 5, occurredAt: wib(2026, 8, 1) },
  ];
  const items = [item("a", 10), item("b", 4), item("c", 0), item("d", 0)];

  function sums(rows: ReportLedgerRow[]) {
    const before = new Map<string, number>();
    const within = new Map<string, WithinSum>();
    for (const r of rows) {
      if (r.occurredAt < range.start) before.set(r.itemId, (before.get(r.itemId) ?? 0) + r.quantityDelta);
      else if (r.occurredAt < range.end) {
        const key = r.itemId + r.type;
        const w = within.get(key) ?? { itemId: r.itemId, type: r.type, sum: 0 };
        w.sum += r.quantityDelta;
        within.set(key, w);
      }
    }
    return { before, within: [...within.values()] };
  }

  it("monthly report", () => {
    const { before, within } = sums(ledger);
    expect(buildMonthlyReportFromSums(items, before, within)).toEqual(buildMonthlyReport(items, ledger, range));
  });

  it("monthly issued buckets", () => {
    const now = wib(2026, 10, 15);
    const rows = [
      { occurredAt: wib(2026, 10, 2), quantityDelta: -4, category: "APD" },
      { occurredAt: wib(2026, 10, 31, 23), quantityDelta: -6, category: "ATK" },
      { occurredAt: wib(2026, 9, 30, 23), quantityDelta: -3, category: "APD" },
      { occurredAt: wib(2026, 5, 1), quantityDelta: -9, category: "ATK" },
    ];
    const agg = new Map<string, { key: string; category: string; units: number }>();
    for (const r of rows) {
      const key = monthKey(r.occurredAt);
      const id = key + r.category;
      const a = agg.get(id) ?? { key, category: r.category, units: 0 };
      a.units += -r.quantityDelta;
      agg.set(id, a);
    }
    expect(bucketFromAggregates([...agg.values()], 6, now)).toEqual(bucketMonthlyIssued(rows, 6, now));
  });
});

describe("bucketMonthlyIssued", () => {
  it("returns the last N months oldest first, keeping empty months", () => {
    const now = wib(2026, 10, 6);
    const buckets = bucketMonthlyIssued(
      [
        { occurredAt: wib(2026, 10, 2), quantityDelta: -5, category: "APD" },
        { occurredAt: wib(2026, 10, 3), quantityDelta: -2, category: "ATK" },
        { occurredAt: wib(2026, 8, 1), quantityDelta: -7, category: "APD" },
        { occurredAt: wib(2025, 1, 1), quantityDelta: -99, category: "APD" },
      ],
      4,
      now
    );
    expect(buckets.map((b) => b.key)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(buckets[1]).toMatchObject({ APD: 7, ATK: 0 });
    expect(buckets[2]).toMatchObject({ APD: 0, ATK: 0 });
    expect(buckets[3]).toMatchObject({ APD: 5, ATK: 2 });
  });

  it("rolls back across a year boundary", () => {
    const buckets = bucketMonthlyIssued([], 3, wib(2026, 1, 15));
    expect(buckets.map((b) => b.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

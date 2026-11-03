// "Ringkasan aset" on the Admin GA Beranda: how many assets are in use and how many are not, per category. Pure, so it
// is unit tested. Counted per unit: an individually tracked asset is one unit, a quantity-tracked one is as many units as
// its total quantity, of which the available quantity is not in use.
import { ASSET_CATEGORIES } from "@/lib/asset-categories";

export interface AssetForSummary {
  category: string | null;
  status: string;
  trackingType: "INDIVIDUAL" | "QUANTITY_TRACKED";
  totalQuantity: number | null;
  availableQuantity: number | null;
}

export interface CategorySummary {
  category: string;
  /** Link filter value, null for assets without a category. */
  categoryFilter: string | null;
  inUse: number;
  /** Not in use: ready to be handed out. */
  available: number;
  /** Under repair, waiting for disposal or lost. */
  other: number;
  total: number;
  /** Asset records behind the units: differs from total when quantity-tracked assets are in the category. */
  records: number;
}

export interface AssetSummary {
  inUse: number;
  available: number;
  other: number;
  total: number;
  categories: CategorySummary[];
}

const OUT_OF_CIRCULATION = new Set(["UNDER_REPAIR", "PENDING_DISPOSAL", "LOST_PENDING_REVIEW"]);
const GONE = new Set(["RETIRED", "DISPOSED"]);
const NO_CATEGORY = "Tanpa kategori";

export function summarizeAssets(assets: AssetForSummary[]): AssetSummary {
  const byCategory = new Map<string, CategorySummary>();
  const row = (category: string | null) => {
    const key = category ?? NO_CATEGORY;
    let r = byCategory.get(key);
    if (!r) {
      r = { category: key, categoryFilter: category, inUse: 0, available: 0, other: 0, total: 0, records: 0 };
      byCategory.set(key, r);
    }
    return r;
  };

  for (const a of assets) {
    if (GONE.has(a.status)) continue;
    const r = row(a.category);
    r.records += 1;
    if (a.trackingType === "QUANTITY_TRACKED") {
      const total = Math.max(0, a.totalQuantity ?? 0);
      const available = Math.min(total, Math.max(0, a.availableQuantity ?? total));
      r.total += total;
      if (OUT_OF_CIRCULATION.has(a.status)) r.other += total;
      else {
        r.available += available;
        r.inUse += total - available;
      }
    } else {
      r.total += 1;
      if (a.status === "IN_USE") r.inUse += 1;
      else if (a.status === "AVAILABLE") r.available += 1;
      else r.other += 1;
    }
  }

  const order = (c: string) => {
    const i = (ASSET_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? ASSET_CATEGORIES.length : i;
  };
  const categories = [...byCategory.values()].filter((c) => c.total > 0).sort((x, y) => order(x.category) - order(y.category) || x.category.localeCompare(y.category));
  const sum = (pick: (c: CategorySummary) => number) => categories.reduce((n, c) => n + pick(c), 0);
  return { inUse: sum((c) => c.inUse), available: sum((c) => c.available), other: sum((c) => c.other), total: sum((c) => c.total), categories };
}

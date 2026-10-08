// Pure business logic for consumables (APD/ATK). No Prisma/Next imports —
// unit testable, same pattern as assets.ts. Stock and status are never
// stored: they are derived here from openingStock + the non-cancelled ledger.
import { companyDateParts, companyToday, startOfCompanyDay, WIB_OFFSET_MS } from "@/lib/company-time";

export type ConsumableStatusValue = "AMAN" | "MENIPIS" | "HABIS";
export type ConsumableCategoryValue = "APD" | "ATK";
export type ConsumableTxTypeValue = "ISSUE" | "RECEIPT" | "ADJUSTMENT";

// Habis at zero or below (an allowed over-take can push stock negative),
// Menipis at or under the minimum, otherwise Aman.
export function stockStatus(stock: number, minStock: number): ConsumableStatusValue {
  if (stock <= 0) return "HABIS";
  if (stock <= minStock) return "MENIPIS";
  return "AMAN";
}

// How many items are in each stock status (Aman / Menipis / Habis).
export function countByStatus(items: { status: ConsumableStatusValue }[]): Record<ConsumableStatusValue, number> {
  const counts: Record<ConsumableStatusValue, number> = { AMAN: 0, MENIPIS: 0, HABIS: 0 };
  for (const i of items) counts[i.status] += 1;
  return counts;
}

export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

// A yyyy-mm-dd date from a form is a company-local calendar day. Blank or
// today keeps the real current instant; a past day lands at noon WIB so the
// day is never ambiguous. Future and malformed dates are reported, not coerced.
export function parseCompanyDateInput(raw: string, now: Date = new Date()): Date | "invalid" | "future" {
  if (!raw) return now;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return "invalid";
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const day = new Date(Date.UTC(y, m - 1, d));
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return "invalid";
  const today = companyToday(now);
  if (day.getTime() > today.getTime()) return "future";
  if (day.getTime() === today.getTime()) return now;
  return new Date(day.getTime() - WIB_OFFSET_MS + 12 * 60 * 60 * 1000);
}

// Signed ledger delta for each movement. ISSUE is stored negative, RECEIPT
// positive; ADJUSTMENT is whatever brings the live system stock to the count.
export function issueDelta(quantity: number): number {
  return -quantity;
}

export function adjustmentDelta(systemStock: number, physicalStock: number): number {
  return physicalStock - systemStock;
}

// The company-local calendar day `months` after `from`, clamped to the end of
// shorter months (31 Jan + 1 month = 28/29 Feb), returned as the instant that
// day begins in WIB — comparable against any timestamp via startOfCompanyDay.
export function addMonthsCompany(from: Date, months: number): Date {
  const { year, month, day } = companyDateParts(from);
  const targetIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(targetIndex / 12);
  const targetMonth = targetIndex % 12; // 0-11
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay) - WIB_OFFSET_MS);
}

// null when the item has no replacement period, or the person never took it.
export function nextEligibleDate(lastIssueAt: Date | null, periodMonths: number): Date | null {
  if (!lastIssueAt || periodMonths <= 0) return null;
  return addMonthsCompany(lastIssueAt, periodMonths);
}

export interface IssueWarningInput {
  stock: number;
  quantity: number;
  // Only meaningful for an EMPLOYEE take — pass null for a department take,
  // which is exempt from the replacement-period rule.
  lastIssueAt: Date | null;
  periodMonths: number;
  occurredAt: Date;
}

export interface IssueWarnings {
  beforePeriod: boolean;
  nextEligible: Date | null;
  exceedsStock: boolean;
  // How many units the take is over the available stock (0 when it fits).
  shortfall: number;
  hasWarning: boolean;
}

export function evaluateIssueWarnings(input: IssueWarningInput): IssueWarnings {
  const nextEligible = nextEligibleDate(input.lastIssueAt, input.periodMonths);
  const beforePeriod = nextEligible !== null && startOfCompanyDay(input.occurredAt) < nextEligible;
  const shortfall = Math.max(0, input.quantity - Math.max(0, input.stock));
  const exceedsStock = shortfall > 0;
  return { beforePeriod, nextEligible, exceedsStock, shortfall, hasWarning: beforePeriod || exceedsStock };
}

// Cancelling a RECEIPT removes stock; flag it when that would go below zero so
// the screen can ask for confirmation (allowed, consistent with over-takes).
export function cancelWouldGoNegative(currentStock: number, row: { type: ConsumableTxTypeValue; quantityDelta: number }): boolean {
  if (row.type === "ISSUE") return false;
  return currentStock - row.quantityDelta < 0;
}

// Next code suggestion for a category: highest numeric suffix + 1, so a code
// imported from the old system never collides with a freshly suggested one.
export function suggestNextItemCode(category: ConsumableCategoryValue, existingCodes: string[]): string {
  const prefix = `${category}-`;
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// Pure helpers for the Admin GA Beranda: how long something has been waiting,
// how urgent that makes it, and the order of the "Perlu ditindak" list. No
// Prisma/Next imports — unit testable. Days are company (WIB) calendar days.
import { companyToday, DAY_MS } from "@/lib/company-time";

export type Severity = "rose" | "amber" | "slate";


// Whole company days from `from` to `now` (0 = same day).
export function daysSince(from: Date, now: Date = new Date()): number {
  return Math.max(0, Math.round((companyToday(now).getTime() - companyToday(from).getTime()) / DAY_MS));
}

// Whole company days from `now` until `due` (negative once overdue).
export function daysUntil(due: Date, now: Date = new Date()): number {
  return Math.round((companyToday(due).getTime() - companyToday(now).getTime()) / DAY_MS);
}

// Something waiting for GA: amber from 3 days, rose from 7.
export function waitingSeverity(ageDays: number): Severity {
  if (ageDays >= 7) return "rose";
  if (ageDays >= 3) return "amber";
  return "slate";
}

// Something with a deadline (offboarding clearance): rose when overdue or due
// within 3 days, amber within 7, otherwise quiet.
export function deadlineSeverity(daysLeft: number): Severity {
  if (daysLeft <= 3) return "rose";
  if (daysLeft <= 7) return "amber";
  return "slate";
}

export function waitingLabel(ageDays: number): string {
  return ageDays === 0 ? "baru hari ini" : `menunggu ${ageDays} hari`;
}

export function deadlineLabel(daysLeft: number): string {
  if (daysLeft < 0) return `terlambat ${Math.abs(daysLeft)} hari`;
  if (daysLeft === 0) return "batas hari ini";
  return `${daysLeft} hari lagi`;
}

export type TodoKind = "ga" | "wo" | "dp" | "of" | "st" | "pm";

export interface TodoRow {
  kind: TodoKind;
  type: string;
  title: string;
  who: string;
  statusLabel: string;
  severity: Severity;
  // Sort weight inside a severity: larger = needs attention sooner.
  urgency: number;
  timeLabel: string;
  actionLabel: string;
  href: string;
}

const SEVERITY_RANK: Record<Severity, number> = { rose: 0, amber: 1, slate: 2 };

// Most urgent first: rose, then amber, then the rest; inside each, the one
// waiting longest (or closest to its deadline) first.
export function sortTodo(rows: TodoRow[]): TodoRow[] {
  return [...rows].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.urgency - a.urgency);
}

export function oldestAge(dates: Date[], now: Date = new Date()): number | null {
  if (dates.length === 0) return null;
  return daysSince(new Date(Math.min(...dates.map((d) => d.getTime()))), now);
}

export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
}

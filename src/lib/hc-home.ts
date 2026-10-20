// Pure helpers for the Admin HC Beranda: which time group a task belongs to,
// the order inside a group, and the payroll-period progress. No Prisma/Next
// imports, so it is unit testable. Severity and the waiting/deadline wording
// are shared with the Admin GA Beranda (ga-home.ts).
import { DAY_MS } from "@/lib/company-time";
import { sortTodo, type Severity } from "@/lib/ga-home";

export type HcKind = "rc" | "ob" | "ct" | "mv" | "ab" | "of";
export type Horizon = "late" | "today" | "week" | "upcoming";

export interface HcTodoRow {
  kind: HcKind;
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
  horizon: Horizon;
  // Row whose action is a button on the Beranda itself instead of a link.
  startEvaluationContractId?: string;
}

// Something already waiting for HC: from a week of waiting it counts as late,
// otherwise it can be worked on today.
export function horizonForWaiting(ageDays: number): Horizon {
  return ageDays >= 7 ? "late" : "today";
}

// Something with a deadline: past it = late, within 2 days = today, within a
// week = this week, anything further is only coming up.
export function horizonForDeadline(daysLeft: number): Horizon {
  if (daysLeft < 0) return "late";
  if (daysLeft <= 2) return "today";
  if (daysLeft <= 7) return "week";
  return "upcoming";
}

export const HORIZON_ORDER: Horizon[] = ["late", "today", "week", "upcoming"];

export const HORIZON_META: Record<Horizon, { label: string; hint: string }> = {
  late: { label: "Terlambat", hint: "lewat batas atau sudah lama menunggu" },
  today: { label: "Hari ini", hint: "siap dikerjakan sekarang" },
  week: { label: "Minggu ini", hint: "batasnya dalam 7 hari" },
  upcoming: { label: "Menjelang", hint: "batasnya lebih dari seminggu lagi" },
};

export interface HcGroup {
  horizon: Horizon;
  label: string;
  hint: string;
  rows: HcTodoRow[];
}

// The four time groups in reading order; a group with no rows is left out.
export function groupByHorizon(rows: HcTodoRow[]): HcGroup[] {
  return HORIZON_ORDER.map((horizon) => ({
    horizon,
    ...HORIZON_META[horizon],
    rows: sortTodo(rows.filter((r) => r.horizon === horizon)),
  })).filter((g) => g.rows.length > 0);
}

export interface PayrollProgress {
  totalDays: number;
  elapsedDays: number;
  daysLeft: number;
  elapsedPercent: number;
}

// Where `today` stands in a payroll period (start and end both inclusive, all
// three UTC-midnight dates). Before the period it reads 0%, after it 100%.
export function payrollProgress(start: Date, end: Date, today: Date): PayrollProgress {
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1));
  const daysLeft = Math.max(0, Math.round((end.getTime() - today.getTime()) / DAY_MS));
  return { totalDays, elapsedDays, daysLeft, elapsedPercent: Math.round((elapsedDays / totalDays) * 100) };
}

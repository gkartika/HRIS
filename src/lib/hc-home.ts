// Pure helpers for the Admin SDM Beranda: which kind of work a to-do belongs to, the order of the groups and of the rows
// inside them, the payroll-period progress and the department counts of the organisation outlook. No Prisma/Next
// imports, so it is unit testable. Severity and the waiting/deadline wording are shared with the Admin GA Beranda
// (ga-home.ts).
import { DAY_MS } from "@/lib/company-time";
import { SEVERITY_RANK, sortTodo, type Severity } from "@/lib/ga-home";

export type HcKind = "rc" | "ob" | "ct" | "mv" | "ab" | "of";
export type HcCategory = "ob" | "of" | "ct" | "mv" | "ab" | "data";

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
  // Row whose action is a button on the Beranda itself instead of a link.
  startEvaluationContractId?: string;
}

// The kinds of work, in the order they are listed when they are equally urgent.
export const HC_CATEGORIES: { key: HcCategory; label: string; hint: string }[] = [
  { key: "of", label: "Offboarding", hint: "karyawan yang akan keluar" },
  { key: "ob", label: "Karyawan baru", hint: "onboarding yang belum lengkap, yang masuk lebih dulu di atas" },
  { key: "ct", label: "Kontrak dan perpanjangan", hint: "kontrak yang berakhir dan perpanjangan yang berjalan" },
  { key: "mv", label: "Perubahan Posisi", hint: "sudah disetujui, tinggal dijalankan" },
  { key: "ab", label: "Absensi dan cuti", hint: "payroll dan penyetuju cuti" },
  { key: "data", label: "Data dan akun", hint: "kelengkapan yang menghambat modul lain" },
];

export const HC_FILTERS: { key: HcCategory | "all"; label: string }[] = [{ key: "all", label: "Semua" }, ...HC_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))];

export function categoryOf(row: Pick<HcTodoRow, "kind" | "type">): HcCategory {
  if (row.kind === "ob") return row.type === "Akun login" ? "data" : "ob";
  if (row.kind === "rc") return "ct";
  return row.kind;
}

export interface HcGroup {
  key: HcCategory;
  label: string;
  hint: string;
  rows: HcTodoRow[];
}

// Groups with something to do, the one holding the most urgent row first; rows inside a group most urgent first.
export function groupByCategory(rows: HcTodoRow[]): HcGroup[] {
  return HC_CATEGORIES.map((c, order) => ({ ...c, order, rows: sortTodo(rows.filter((r) => categoryOf(r) === c.key)) }))
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => SEVERITY_RANK[a.rows[0].severity] - SEVERITY_RANK[b.rows[0].severity] || b.rows[0].urgency - a.rows[0].urgency || a.order - b.order)
    .map(({ key, label, hint, rows: r }) => ({ key, label, hint, rows: r }));
}

export function categoryCounts(rows: HcTodoRow[]): Record<HcCategory | "all", number> {
  const out: Record<HcCategory | "all", number> = { all: rows.length, ob: 0, of: 0, ct: 0, mv: 0, ab: 0, data: 0 };
  for (const r of rows) out[categoryOf(r)] += 1;
  return out;
}

// A new employee's contract still has to be ticked: quiet while the start is far off, amber from two days before, red once
// the person has started without it.
export function onboardingContractSeverity(daysUntilStart: number): Severity {
  if (daysUntilStart < 0) return "rose";
  if (daysUntilStart <= 2) return "amber";
  return "slate";
}

export function startLabel(daysUntilStart: number): string {
  if (daysUntilStart < 0) return `terlambat ${Math.abs(daysUntilStart)} hari`;
  if (daysUntilStart === 0) return "masuk hari ini";
  if (daysUntilStart === 1) return "masuk besok";
  return `masuk ${daysUntilStart} hari lagi`;
}

// Employees per department, biggest first. Departments past `limit` are summed into "Lainnya".
export function departmentBreakdown(counts: Map<string, number>, limit = 6): { name: string; count: number }[] {
  const sorted = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit).reduce((sum, d) => sum + d.count, 0);
  return [...sorted.slice(0, limit), { name: "Lainnya", count: rest }];
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

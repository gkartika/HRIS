import { companyToday, DAY_MS, MONTH_LABELS_ID, WIB_OFFSET_MS } from "@/lib/company-time";

// Numbers for the recruitment dashboard. Everything here is pure: the page loads the rows
// (recruitment-dashboard-data.ts) and these functions turn them into the figures.
//
// The applicant table keeps no "passed on / invited on / hired on" stamps of its own, so each
// milestone is read from what the pipeline already records (tests, interview, offer, movement,
// final status). Hired = the day the status became HIRED, and HIRED is a final status.

export type DashboardSource = "EXTERNAL" | "INTERNAL";

export interface DashboardCandidate {
  id: string;
  source: DashboardSource;
  status: string;
  appliedAt: Date;
  statusChangedAt: Date;
  decidedAt: Date | null;
  departmentId: string;
  /** When the interview was set up / the invitation went out. null = no interview. */
  interviewInvitedAt: Date | null;
  hasOffer: boolean;
  hasMovement: boolean;
  tests: { passed: boolean | null; doneAt: Date | null }[];
}

export interface DashboardRequest {
  id: string;
  departmentId: string;
  status: string;
  approvedAt: Date | null;
  /** The day the last seat was filled (FILLED requests only). */
  filledAt: Date | null;
}

export interface DashboardRange {
  from: Date | null;
  to: Date | null;
}

export const FUNNEL_LABELS = ["Pelamar", "Lolos tes", "Diundang interview", "Interview selesai", "Offering / Perubahan Posisi", "Diterima"] as const;

const OFFER_STAGE_STATUSES = ["OFFERING", "MOVEMENT", "HIRED", "OFFER_DECLINED"];

export interface Milestones {
  appliedAt: Date;
  passedAt: Date | null;
  invitedAt: Date | null;
  hiredAt: Date | null;
  /** How far the applicant got: 1 = applied ... 6 = hired. Cumulative: reaching a stage counts every earlier one. */
  stage: number;
}

export function candidateMilestones(c: DashboardCandidate): Milestones {
  const hired = c.status === "HIRED";
  const allPassed = c.tests.length > 0 && c.tests.every((t) => t.passed === true);
  const offering = c.hasOffer || c.hasMovement || OFFER_STAGE_STATUSES.includes(c.status);
  const interviewed = c.decidedAt !== null || offering || hired;
  const invited = c.interviewInvitedAt !== null || interviewed;
  const passed = allPassed || invited;

  const stage = hired ? 6 : offering ? 5 : interviewed ? 4 : invited ? 3 : passed ? 2 : 1;

  const doneDates = c.tests.map((t) => t.doneAt?.getTime() ?? 0).filter(Boolean);
  const invitedAt = invited ? c.interviewInvitedAt ?? c.decidedAt ?? c.statusChangedAt : null;
  const passedAt = passed ? (allPassed && doneDates.length ? new Date(Math.max(...doneDates)) : invitedAt ?? c.appliedAt) : null;
  return { appliedAt: c.appliedAt, passedAt, invitedAt, hiredAt: hired ? c.statusChangedAt : null, stage };
}

function inRange(d: Date | null, range: DashboardRange): boolean {
  if (!d) return false;
  const t = d.getTime();
  return (!range.from || t >= range.from.getTime()) && (!range.to || t <= range.to.getTime());
}

const average = (values: number[]): number | null => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);
const days = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);

export function monthKey(d: Date): string {
  const w = new Date(d.getTime() + WIB_OFFSET_MS);
  return `${w.getUTCFullYear()}-${String(w.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS_ID[m - 1]} ${String(y).slice(2)}`;
}

// Every month from `from` to `to` (WIB), oldest first.
export function monthsBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const a = new Date(from.getTime() + WIB_OFFSET_MS);
  const b = new Date(to.getTime() + WIB_OFFSET_MS);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth())) {
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return keys;
}

export interface DashboardRow {
  departmentId: string;
  openings: number;
  applicants: number;
  passed: number;
  hired: number;
  hiringRate: number | null;
  timeToFill: number | null;
  filledCount: number;
  timeToHire: number | null;
}

export interface DashboardResult {
  timeToFill: { days: number | null; filled: number };
  timeToHire: { days: number | null; hired: number };
  hiringRate: { percent: number | null; hired: number; applicants: number };
  funnel: { label: string; count: number; fromPrevious: number | null }[];
  trend: { key: string; label: string; applied: number; passed: number; hired: number }[];
  rows: DashboardRow[];
  bySource: { source: DashboardSource; applicants: number; hired: number }[];
}

const MAX_MONTHS = 36;

export function computeDashboard(input: { candidates: DashboardCandidate[]; requests: DashboardRequest[]; range: DashboardRange; now: Date }): DashboardResult {
  const { candidates, requests, range, now } = input;
  const marked = candidates.map((c) => ({ c, m: candidateMilestones(c) }));

  // "Applicants" are the people who applied inside the period; hires and passes are placed by their own date.
  const applied = marked.filter((x) => inRange(x.m.appliedAt, range));
  const hiredInPeriod = marked.filter((x) => inRange(x.m.hiredAt, range));
  const filled = requests.filter((r) => r.status === "FILLED" && r.approvedAt && r.filledAt && inRange(r.filledAt, range));

  const fillDays = filled.map((r) => days(r.approvedAt as Date, r.filledAt as Date));
  const hireDays = hiredInPeriod.map((x) => days(x.m.appliedAt, x.m.hiredAt as Date));
  const hiredOfApplied = applied.filter((x) => x.m.stage === 6).length;

  const funnel = FUNNEL_LABELS.map((label, i) => {
    const count = applied.filter((x) => x.m.stage >= i + 1).length;
    return { label, count, fromPrevious: 0 as number | null };
  });
  funnel.forEach((step, i) => {
    step.fromPrevious = i === 0 ? null : funnel[i - 1].count > 0 ? Math.round((step.count / funnel[i - 1].count) * 1000) / 10 : null;
  });

  // Trend: the months of the period (an open start = from the first applicant).
  const firstEvent = marked.length ? new Date(Math.min(...marked.map((x) => x.m.appliedAt.getTime()))) : now;
  const trendFrom = range.from ?? firstEvent;
  const trendTo = range.to && range.to.getTime() < now.getTime() ? range.to : now;
  let keys = monthsBetween(trendFrom, trendTo);
  if (keys.length > MAX_MONTHS) keys = keys.slice(-MAX_MONTHS);
  const trend = keys.map((key) => ({ key, label: monthLabel(key), applied: 0, passed: 0, hired: 0 }));
  const slot = new Map(trend.map((t) => [t.key, t]));
  for (const x of marked) {
    if (inRange(x.m.appliedAt, range)) {
      const s = slot.get(monthKey(x.m.appliedAt));
      if (s) s.applied += 1;
    }
    if (x.m.passedAt && inRange(x.m.passedAt, range)) {
      const s = slot.get(monthKey(x.m.passedAt));
      if (s) s.passed += 1;
    }
    if (x.m.hiredAt && inRange(x.m.hiredAt, range)) {
      const s = slot.get(monthKey(x.m.hiredAt));
      if (s) s.hired += 1;
    }
  }

  // Per department.
  const departments = new Set<string>([...candidates.map((c) => c.departmentId), ...requests.map((r) => r.departmentId)]);
  const rows: DashboardRow[] = [...departments].map((departmentId) => {
    const dApplied = applied.filter((x) => x.c.departmentId === departmentId);
    const dFilled = filled.filter((r) => r.departmentId === departmentId);
    const dHired = hiredInPeriod.filter((x) => x.c.departmentId === departmentId);
    const hired = dApplied.filter((x) => x.m.stage === 6).length;
    return {
      departmentId,
      openings: requests.filter((r) => r.departmentId === departmentId && inRange(r.approvedAt, range)).length,
      applicants: dApplied.length,
      passed: dApplied.filter((x) => x.m.stage >= 2).length,
      hired,
      hiringRate: dApplied.length ? Math.round((hired / dApplied.length) * 1000) / 10 : null,
      timeToFill: average(dFilled.map((r) => days(r.approvedAt as Date, r.filledAt as Date))),
      filledCount: dFilled.length,
      timeToHire: average(dHired.map((x) => days(x.m.appliedAt, x.m.hiredAt as Date))),
    };
  });
  rows.sort((a, b) => b.applicants - a.applicants || b.openings - a.openings);

  const bySource = (["EXTERNAL", "INTERNAL"] as DashboardSource[]).map((source) => ({
    source,
    applicants: applied.filter((x) => x.c.source === source).length,
    hired: hiredInPeriod.filter((x) => x.c.source === source).length,
  }));

  return {
    timeToFill: { days: average(fillDays), filled: filled.length },
    timeToHire: { days: average(hireDays), hired: hiredInPeriod.length },
    hiringRate: { percent: applied.length ? Math.round((hiredOfApplied / applied.length) * 1000) / 10 : null, hired: hiredOfApplied, applicants: applied.length },
    funnel,
    trend,
    rows,
    bySource,
  };
}

// ---------- filters ----------

export const PERIOD_OPTIONS = [
  { value: "3m", label: "3 bulan terakhir" },
  { value: "6m", label: "6 bulan terakhir" },
  { value: "12m", label: "12 bulan terakhir" },
  { value: "year", label: "Tahun berjalan" },
  { value: "all", label: "Semua waktu" },
  { value: "custom", label: "Pilih tanggal sendiri" },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

export interface DashboardFilters {
  departmentId: string | null;
  level: string | null;
  source: DashboardSource | null;
  period: PeriodValue;
  /** Dates as typed (YYYY-MM-DD) for the custom range; kept so the form can show them again. */
  fromText: string;
  toText: string;
}

// A real calendar date typed as YYYY-MM-DD (31 February is not one).
function isDateText(text: string | undefined): text is string {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

export function parseDashboardFilters(raw: { dept?: string; level?: string; source?: string; period?: string; from?: string; to?: string }, validLevels: string[]): DashboardFilters {
  const period = PERIOD_OPTIONS.find((p) => p.value === raw.period)?.value ?? "12m";
  return {
    departmentId: raw.dept?.trim() || null,
    level: raw.level && validLevels.includes(raw.level) ? raw.level : null,
    source: raw.source === "EXTERNAL" || raw.source === "INTERNAL" ? raw.source : null,
    period,
    fromText: isDateText(raw.from) ? raw.from : "",
    toText: isDateText(raw.to) ? raw.to : "",
  };
}

// The start of a WIB calendar day, as an instant.
function wibStart(utcMidnight: Date): Date {
  return new Date(utcMidnight.getTime() - WIB_OFFSET_MS);
}

export function rangeForFilters(filters: DashboardFilters, now: Date): { range: DashboardRange; error: string | null } {
  const today = companyToday(now);
  const back = (months: number) => wibStart(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate())));
  switch (filters.period) {
    case "3m":
      return { range: { from: back(3), to: now }, error: null };
    case "6m":
      return { range: { from: back(6), to: now }, error: null };
    case "12m":
      return { range: { from: back(12), to: now }, error: null };
    case "year":
      return { range: { from: wibStart(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))), to: now }, error: null };
    case "all":
      return { range: { from: null, to: null }, error: null };
    case "custom": {
      const from = filters.fromText ? wibStart(new Date(`${filters.fromText}T00:00:00Z`)) : null;
      const to = filters.toText ? new Date(wibStart(new Date(`${filters.toText}T00:00:00Z`)).getTime() + DAY_MS - 1) : null;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return { range: { from: null, to: null }, error: "Tanggal tidak valid." };
      if (!from && !to) return { range: { from: null, to: null }, error: "Isi tanggal mulai dan/atau tanggal akhir." };
      if (from && to && from.getTime() > to.getTime()) return { range: { from: null, to: null }, error: "Tanggal mulai harus sebelum tanggal akhir." };
      return { range: { from, to }, error: null };
    }
  }
}

// Unified period resolution for the Mandays Lost report — per direct
// request, viewable per salary cycle and per year. (Week/month views were
// tried and dropped: Siklus Gaji's own weekly breakdown and Tahunan's own
// monthly breakdown already give that granularity with a Total/% column,
// so a separate single-week/single-month drill-down was redundant.)
//
// Same "referenceDate read with LOCAL calendar getters, then re-anchored to
// UTC midnight" two-step as resolveCutoffPeriod (see absence-cutoff.ts) —
// required so "today"/"this year" resolve to the calendar day a person is
// actually in, while the stored start/end stay UTC-midnight date-only
// values comparable against attendanceDate/startDate columns.
import { resolveCutoffPeriod, previousCutoffPeriod, nextCutoffPeriod, type CutoffPeriod } from "@/lib/absence-cutoff";

export type ReportViewType = "cycle" | "year";

export interface ReportPeriod {
  start: Date;
  end: Date;
  label: string;
}

export function resolveYearPeriod(referenceDate: Date): ReportPeriod {
  const year = referenceDate.getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  return { start, end, label: `${year}` };
}

export function resolvePeriod(view: ReportViewType, referenceDate: Date): ReportPeriod {
  if (view === "year") return resolveYearPeriod(referenceDate);
  return resolveCutoffPeriod(referenceDate);
}

export function previousPeriod(view: ReportViewType, period: ReportPeriod): ReportPeriod {
  if (view === "year") return resolveYearPeriod(new Date(period.start.getTime() - 24 * 60 * 60 * 1000));
  return previousCutoffPeriod(period as CutoffPeriod);
}

export function nextPeriod(view: ReportViewType, period: ReportPeriod): ReportPeriod {
  if (view === "year") return resolveYearPeriod(new Date(period.end.getTime() + 24 * 60 * 60 * 1000));
  return nextCutoffPeriod(period as CutoffPeriod);
}

export function parseReportView(value: string | undefined): ReportViewType {
  return value === "year" ? "year" : "cycle";
}

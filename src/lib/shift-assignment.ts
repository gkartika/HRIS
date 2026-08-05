// Pure business logic for Shift Assignment (new, per direct user request:
// "assign shift or non shift for each employee... changes weekly, submitted
// by level 3"). No Prisma/Next imports — unit testable with plain values,
// same pattern as offboarding.ts/movement.ts.

// One row per employee per calendar week (Monday-start), regardless of
// which day within that week the submitter picks — half-open like every
// other effective-dating convention in this app (org-chart.ts,
// hr-manager.ts), just at week granularity instead of a range.
export function normalizeWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

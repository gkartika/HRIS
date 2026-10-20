import { AccessDenied } from "@/components/access-denied";
import { canManageRecruitment } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { loadDashboardData } from "@/lib/recruitment-dashboard-data";
import { computeDashboard, parseDashboardFilters, rangeForFilters } from "@/lib/recruitment-dashboard";
import { RequestedJobLevel } from "@/generated/prisma/enums";
import { DashboardView } from "./dashboard-view";

export default async function RecruitmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; level?: string; source?: string; period?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  if (!canManageRecruitment(session)) return <AccessDenied />;

  const filters = parseDashboardFilters(await searchParams, Object.values(RequestedJobLevel));
  const now = new Date();
  const { range, error } = rangeForFilters(filters, now);
  const effectiveRange = error ? rangeForFilters({ ...filters, period: "12m" }, now).range : range;
  const { candidates, requests, departments } = await loadDashboardData(filters, effectiveRange);
  const result = computeDashboard({ candidates, requests, range: effectiveRange, now });

  return <DashboardView filters={filters} result={result} departments={departments} error={error} />;
}

"use server";

import { requireSession } from "@/lib/permissions";
import { getOrgChartData, type OrgChartData } from "@/lib/org-chart";

export async function fetchOrgChartData(asOfDateIso: string): Promise<OrgChartData> {
  await requireSession();
  const asOfDate = asOfDateIso ? new Date(asOfDateIso) : new Date();
  return getOrgChartData(asOfDate);
}

// How a position was filled and where a Perubahan Posisi came from. Labels, colours and the small counting
// helper, shared by the request page, the dashboard and the move screens. Pure.

export type FulfillmentSourceKey = "RECRUITMENT_EXTERNAL" | "RECRUITMENT_INTERNAL" | "MUTASI";
export type MovementOriginKey = "MUTASI" | "REKRUTMEN_INTERNAL";

export const FULFILLMENT_SOURCES: FulfillmentSourceKey[] = ["RECRUITMENT_EXTERNAL", "RECRUITMENT_INTERNAL", "MUTASI"];

export const FULFILLMENT_SOURCE_LABEL: Record<FulfillmentSourceKey, string> = {
  RECRUITMENT_EXTERNAL: "Rekrutmen eksternal",
  RECRUITMENT_INTERNAL: "Rekrutmen internal",
  MUTASI: "Mutasi",
};

export const FULFILLMENT_SOURCE_TONE: Record<FulfillmentSourceKey, string> = {
  RECRUITMENT_EXTERNAL: "bg-sky-50 text-sky-800",
  RECRUITMENT_INTERNAL: "bg-indigo-50 text-indigo-700",
  MUTASI: "bg-amber-50 text-amber-800",
};

export const FULFILLMENT_SOURCE_BAR: Record<FulfillmentSourceKey, string> = {
  RECRUITMENT_EXTERNAL: "bg-sky-500",
  RECRUITMENT_INTERNAL: "bg-indigo-500",
  MUTASI: "bg-amber-500",
};

export const MOVEMENT_ORIGINS: MovementOriginKey[] = ["REKRUTMEN_INTERNAL", "MUTASI"];

export const MOVEMENT_ORIGIN_LABEL: Record<MovementOriginKey, string> = {
  REKRUTMEN_INTERNAL: "Rekrutmen internal",
  MUTASI: "Mutasi",
};

export const MOVEMENT_ORIGIN_TONE: Record<MovementOriginKey, string> = {
  REKRUTMEN_INTERNAL: "bg-indigo-50 text-indigo-700",
  MUTASI: "bg-amber-50 text-amber-800",
};

// The one total and its detail: { total, RECRUITMENT_EXTERNAL, RECRUITMENT_INTERNAL, MUTASI }.
export function countBySource(sources: FulfillmentSourceKey[]): Record<FulfillmentSourceKey, number> & { total: number } {
  const counts = { RECRUITMENT_EXTERNAL: 0, RECRUITMENT_INTERNAL: 0, MUTASI: 0, total: sources.length };
  for (const s of sources) counts[s] += 1;
  return counts;
}

// "1 Rekrutmen eksternal · 1 Rekrutmen internal" (ways with no one are left out).
export function describeSources(counts: Record<FulfillmentSourceKey, number>): string {
  return FULFILLMENT_SOURCES.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${FULFILLMENT_SOURCE_LABEL[s]}`)
    .join(" · ");
}

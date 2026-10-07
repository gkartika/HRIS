import type { ReactNode } from "react";

const SHAPE = { square: "rounded-md", pill: "rounded-full" } as const;

// The one status badge used in lists and detail headers. `tone` is a
// "bg-… text-…" pair taken from a status map (see lib/status-ui.ts).
export function StatusChip({ tone, shape = "square", children }: { tone: string; shape?: keyof typeof SHAPE; children: ReactNode }) {
  return <span className={`${SHAPE[shape]} px-2 py-1 text-xs font-medium ${tone}`}>{children}</span>;
}

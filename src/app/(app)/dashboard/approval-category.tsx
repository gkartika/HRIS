"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

// Sub-groups the merged "Perlu Persetujuan Anda" list by the same category
// names used in the sidebar (src/app/(app)/sidebar-nav.tsx) — still one card
// overall, collapsed to just a label + count per category by default so a
// category with many items (e.g. Penilaian Kompetensi) doesn't flood the
// card; tap the row to expand it. `children` (the actual ApprovalRow list)
// is server-rendered as usual — only the expand/collapse state is
// client-side, same composition pattern as sidebar-nav.tsx's groups.
export function ApprovalCategory({
  label,
  count,
  unit = "menunggu",
  children,
}: {
  label: string;
  count: number;
  unit?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div className="mt-2 border-t border-slate-100 pt-2 first:mt-0 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-2 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-900">
          {label} <span className="font-normal text-slate-400">({count} {unit})</span>
        </span>
        <ChevronRight size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

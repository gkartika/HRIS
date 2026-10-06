import { EXIT_CLEARANCE_FORM_NUMBER } from "@/lib/offboarding";

// Small pill with the Exit Clearance form number, for card titles.
export function FormNumberBadge() {
  return (
    <span className="shrink-0 rounded-md border border-brand/30 bg-brand-soft px-2 py-1 font-mono text-xs font-bold text-brand-dark">
      {EXIT_CLEARANCE_FORM_NUMBER}
    </span>
  );
}

// Strip across the top of the case card: form name on the left, number on the right.
export function FormNumberStrip() {
  return (
    <div className="-mx-6 -mt-6 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-brand-soft px-6 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-dark">Formulir Exit Clearance</p>
      <p className="font-mono text-sm font-bold text-brand-dark">No. Form: {EXIT_CLEARANCE_FORM_NUMBER}</p>
    </div>
  );
}

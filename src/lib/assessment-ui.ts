// Colours for the assessment screens (same "bg-… text-…" pairs StatusChip takes).
export const RUBRIC_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-sky-50 text-sky-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export const SCREENING_TONE: Record<string, string> = {
  INCOMPLETE: "bg-slate-100 text-slate-600",
  NO_AGGREGATE_CONCERN: "bg-emerald-50 text-emerald-700",
  INTERVIEW_ATTENTION: "bg-amber-50 text-amber-700",
  PRIORITY_REVIEW: "bg-rose-50 text-rose-700",
};

export const RISK_SIGNAL_TONE: Record<string, string> = {
  "0": "bg-slate-100 text-slate-600",
  "-1": "bg-amber-50 text-amber-700",
  "-2": "bg-rose-50 text-rose-700",
};

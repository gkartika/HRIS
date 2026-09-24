import Link from "next/link";
import { t } from "@/lib/i18n/id";

// One empty-list block for every screen: says what's missing and offers the
// next step — reset filters when a filter caused the emptiness, otherwise the
// "create the first one" button (only passed in when the viewer may use it).
export function EmptyState({
  message,
  filtered = false,
  resetHref,
  action,
  hint,
}: {
  message: string;
  filtered?: boolean;
  resetHref?: string;
  action?: { href: string; label: string };
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{filtered ? t("common.noFilteredResults") : message}</p>
      {!filtered && hint && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
      <div className="mt-4 flex justify-center gap-2">
        {filtered && resetHref && (
          <Link href={resetHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {t("common.resetFilter")}
          </Link>
        )}
        {!filtered && action && (
          <Link href={action.href} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

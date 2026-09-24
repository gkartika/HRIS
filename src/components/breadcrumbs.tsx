import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

// Trail shown at the top of every detail page. The last item is the current
// page (plain text); on a phone the trail collapses to one "back" link to the
// parent so the way out is always one tap.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const parent = [...items].reverse().find((i) => i.href);
  return (
    <div className="mb-4">
      <nav aria-label="Navigasi" className="hidden flex-wrap items-center gap-1.5 text-xs text-slate-500 md:flex">
        {items.map((item, i) => (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} className="font-medium text-indigo-600 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-700">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
      {parent?.href && (
        <Link href={parent.href} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 md:hidden">
          <ChevronLeft size={16} />
          {parent.label}
        </Link>
      )}
    </div>
  );
}

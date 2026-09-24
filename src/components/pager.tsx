import Link from "next/link";
import { PAGE_SIZE } from "@/lib/pagination";

// Previous / next links under a list, keeping whatever filters are in the URL.
export function Pager({
  page,
  total,
  basePath,
  params = {},
  size = PAGE_SIZE,
}: {
  page: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  size?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const linkClass = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Halaman {page} dari {totalPages} · {total} data
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={linkClass}>
            ← Sebelumnya
          </Link>
        )}
        {page < totalPages && (
          <Link href={href(page + 1)} className={linkClass}>
            Berikutnya →
          </Link>
        )}
      </div>
    </div>
  );
}

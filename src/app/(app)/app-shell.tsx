"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { FilterEnhancer } from "@/components/filter-enhancer";

// Desktop: sidebar is a fixed 256px column (unchanged). Phone/tablet (< md):
// the sidebar becomes a slide-in drawer opened from a top bar, closed by the
// backdrop, the X button, Escape, or by navigating to another page.
export function AppShell({
  appName,
  sidebar,
  children,
}: {
  appName: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  // The drawer is open only for the page it was opened on, so navigating
  // anywhere closes it without an effect.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] shrink-0 flex-col bg-brand transition-transform md:static md:z-auto md:max-w-none md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
          className="absolute top-3 right-3 rounded-md p-1.5 text-white/70 hover:bg-white/10 md:hidden"
        >
          <X size={18} />
        </button>
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-brand px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
            aria-expanded={open}
            className="rounded-md p-1.5 text-white hover:bg-white/10"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-white">{appName}</span>
        </header>
        <Suspense fallback={null}>
          <FilterEnhancer />
        </Suspense>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

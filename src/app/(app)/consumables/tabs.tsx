"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ConsumableTab {
  href: string;
  label: string;
}

export function ConsumableTabs({ tabs }: { tabs: ConsumableTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm">
      {tabs.map((tab) => {
        const active = tab.href === "/consumables" ? pathname === "/consumables" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 font-medium ${active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
